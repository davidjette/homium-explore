/**
 * HubSpot Integration — Create/update contacts and deals from Explorer leads
 *
 * Sync triggers:
 * 1. lead_submitted → create contact + deal (may lack program data)
 * 2. program_viewed / model_run → update deal with program params (if lead already identified)
 */

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_TOKEN || '';
const HUBSPOT_PIPELINE_ID = process.env.HUBSPOT_PIPELINE_ID || '';
const HUBSPOT_STAGE_ID = process.env.HUBSPOT_STAGE_ID || '';
const HUBSPOT_API = 'https://api.hubapi.com';

export interface LeadData {
  email: string;
  name: string;
  organization: string;
  role?: string;
  state?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface ProgramConfig {
  state?: string;
  programName?: string;
  totalRaise?: number;
  samPct?: number;        // homiumSAPct
  hpaPct?: number;        // assumptions.hpaPct
  noteTermYrs?: number;   // program.maxHoldYears
  downPaymentPct?: number;
  medianHomeValue?: number; // MID tier
  medianIncome?: number;    // MID tier
}

function isEnabled(): boolean {
  return !!(HUBSPOT_TOKEN && HUBSPOT_PIPELINE_ID && HUBSPOT_STAGE_ID);
}

async function hubspotFetch(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${HUBSPOT_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot API ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Extract a flat ProgramConfig from raw model_run or program_viewed event_data.
 */
export function extractProgramConfig(eventData: any): ProgramConfig {
  if (!eventData) return {};

  // model_run has nested config object
  const config = eventData.config || eventData;
  const mid = config.scenarios?.find((s: any) => s.name === 'MID');

  return {
    state: config.geography?.state || config.state || eventData.state || undefined,
    programName: config.name || eventData.programName || undefined,
    totalRaise: config.raise?.totalRaise || eventData.totalRaise || undefined,
    samPct: config.program?.homiumSAPct || undefined,
    hpaPct: config.assumptions?.hpaPct || undefined,
    noteTermYrs: config.program?.maxHoldYears || undefined,
    downPaymentPct: config.program?.downPaymentPct || undefined,
    medianHomeValue: mid?.medianHomeValue || undefined,
    medianIncome: mid?.medianIncome || undefined,
  };
}

// ── Contact Operations ──

async function upsertContact(lead: LeadData): Promise<string> {
  const properties: Record<string, string> = {
    email: lead.email,
    firstname: lead.name.split(' ')[0] || '',
    lastname: lead.name.split(' ').slice(1).join(' ') || '',
    company: lead.organization,
  };
  if (lead.role) properties.jobtitle = lead.role;
  if (lead.state) properties.state = lead.state;

  // Try to find existing contact by email
  try {
    const search = await hubspotFetch('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{
          filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }],
        }],
      }),
    });

    if (search.total > 0) {
      const contactId = search.results[0].id;
      await hubspotFetch(`/crm/v3/objects/contacts/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties }),
      });
      return contactId;
    }
  } catch (e: any) {
    console.warn('[HubSpot] Contact search failed, creating new:', e.message);
  }

  // Create new
  const contact = await hubspotFetch('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        ...properties,
        hs_lead_status: 'NEW',
        lifecyclestage: 'lead',
      },
    }),
  });

  return contact.id;
}

// ── Deal Operations ──

function buildDealProperties(lead: LeadData, program: ProgramConfig): Record<string, string> {
  const state = program.state || lead.state || '';
  const dealName = `${lead.organization} — ${state || 'Unknown'} Program Interest`;

  const props: Record<string, string> = {
    dealname: dealName,
    dealstage: HUBSPOT_STAGE_ID,
    pipeline: HUBSPOT_PIPELINE_ID,
    explorer_lead_source: 'explore.homium.io',
  };

  // Custom Explorer properties
  if (state) props.explorer_state = state;
  if (program.programName) props.explorer_program_name = program.programName;
  if (program.totalRaise) {
    props.explorer_fund_size = String(program.totalRaise);
    props.amount = String(program.totalRaise);
  }
  if (program.samPct) props.explorer_sam_pct = String(program.samPct);
  if (program.hpaPct) props.explorer_hpa_pct = String(program.hpaPct);
  if (program.noteTermYrs) props.explorer_note_term = String(program.noteTermYrs);
  if (program.downPaymentPct) props.explorer_down_payment_pct = String(program.downPaymentPct);
  if (program.medianHomeValue) props.explorer_median_home_value = String(program.medianHomeValue);
  if (program.medianIncome) props.explorer_median_income = String(program.medianIncome);

  // Description with full context
  const desc = [
    `Lead from explore.homium.io`,
    `Contact: ${lead.name} (${lead.email})`,
    `Organization: ${lead.organization}`,
    lead.role ? `Role: ${lead.role}` : '',
    state ? `State: ${state}` : '',
    program.programName ? `Program: ${program.programName}` : '',
    program.totalRaise ? `Fund Size: $${program.totalRaise.toLocaleString()}` : '',
    program.samPct ? `SAM: ${(program.samPct * 100).toFixed(0)}%` : '',
    program.hpaPct ? `HPA: ${(program.hpaPct * 100).toFixed(0)}%` : '',
    program.noteTermYrs ? `Note Term: ${program.noteTermYrs} years` : '',
    program.medianHomeValue ? `Median Home Value (MID): $${program.medianHomeValue.toLocaleString()}` : '',
    program.medianIncome ? `Median Income (MID): $${program.medianIncome.toLocaleString()}` : '',
  ].filter(Boolean).join('\n');
  props.description = desc;

  return props;
}

async function createDeal(contactId: string, lead: LeadData, program: ProgramConfig): Promise<string> {
  const properties = buildDealProperties(lead, program);

  const deal = await hubspotFetch('/crm/v3/objects/deals', {
    method: 'POST',
    body: JSON.stringify({
      properties,
      associations: [{
        to: { id: contactId },
        types: [{
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 3, // deal-to-contact
        }],
      }],
    }),
  });

  return deal.id;
}

/**
 * Find the most recent deal for this contact in the Explorer pipeline.
 */
async function findExistingDeal(contactId: string): Promise<string | null> {
  try {
    const assocs = await hubspotFetch(
      `/crm/v3/objects/contacts/${contactId}/associations/deals`
    );
    if (!assocs.results?.length) return null;

    // Check each associated deal — find one in our pipeline
    for (const assoc of assocs.results) {
      const deal = await hubspotFetch(
        `/crm/v3/objects/deals/${assoc.id}?properties=pipeline`
      );
      if (deal.properties?.pipeline === HUBSPOT_PIPELINE_ID) {
        return deal.id;
      }
    }
  } catch {
    // No associations or error — return null
  }
  return null;
}

async function updateDeal(dealId: string, lead: LeadData, program: ProgramConfig): Promise<void> {
  const properties = buildDealProperties(lead, program);
  // Don't overwrite pipeline/stage on update
  delete properties.dealstage;
  delete properties.pipeline;

  await hubspotFetch(`/crm/v3/objects/deals/${dealId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
}

// ── Public API ──

/**
 * Called on lead_submitted — create contact + deal.
 * Program data may be empty at this point (lead gate shows before program view).
 */
export async function syncLeadToHubSpot(
  lead: LeadData,
  program: ProgramConfig = {},
): Promise<{ contactId: string; dealId: string } | null> {
  if (!isEnabled()) {
    console.warn('[HubSpot] Not configured — skipping sync');
    return null;
  }

  try {
    const contactId = await upsertContact(lead);
    const existingDealId = await findExistingDeal(contactId);

    let dealId: string;
    if (existingDealId) {
      await updateDeal(existingDealId, lead, program);
      dealId = existingDealId;
      console.log(`[HubSpot] Updated existing deal ${dealId} for ${lead.email}`);
    } else {
      dealId = await createDeal(contactId, lead, program);
      console.log(`[HubSpot] Created contact=${contactId}, deal=${dealId} for ${lead.email}`);
    }

    return { contactId, dealId };
  } catch (e: any) {
    console.error('[HubSpot] Sync failed:', e.message);
    return null;
  }
}

/**
 * Called on program_viewed / model_run — enrich existing deal with program data.
 * Only fires if the session already has an identified lead.
 */
export async function enrichDealWithProgram(
  lead: LeadData,
  program: ProgramConfig,
): Promise<void> {
  if (!isEnabled()) return;

  try {
    const contactId = await upsertContact(lead);
    const dealId = await findExistingDeal(contactId);

    if (dealId) {
      await updateDeal(dealId, lead, program);
      console.log(`[HubSpot] Enriched deal ${dealId} with program data (${program.state} / $${program.totalRaise?.toLocaleString()})`);
    } else {
      // No deal yet — create one (lead submitted but deal creation may have failed)
      const newDealId = await createDeal(contactId, lead, program);
      console.log(`[HubSpot] Created deal ${newDealId} on program event for ${lead.email}`);
    }
  } catch (e: any) {
    console.error('[HubSpot] Enrich failed:', e.message);
  }
}

/**
 * Utility: list pipelines (for setup / debugging).
 */
export async function listPipelines(): Promise<any> {
  if (!HUBSPOT_TOKEN) throw new Error('HUBSPOT_API_TOKEN not configured');
  return hubspotFetch('/crm/v3/pipelines/deals');
}
