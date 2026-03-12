/**
 * HubSpot Integration — Create/update contacts and deals from Explorer leads
 *
 * When a lead submits the form on explore.homium.io, this module:
 * 1. Creates or updates a HubSpot contact (deduplicated by email)
 * 2. Creates a deal in the configured pipeline with program parameters
 * 3. Associates the deal with the contact
 */

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_TOKEN || '';
const HUBSPOT_PIPELINE_ID = process.env.HUBSPOT_PIPELINE_ID || '';
const HUBSPOT_STAGE_ID = process.env.HUBSPOT_STAGE_ID || '';
const HUBSPOT_API = 'https://api.hubapi.com';

interface LeadData {
  email: string;
  name: string;
  organization: string;
  role?: string;
  state?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

interface ProgramData {
  programName?: string;
  totalRaise?: number;
  [key: string]: unknown;
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
 * Create or update a contact. HubSpot deduplicates by email.
 * Returns the contact ID.
 */
async function upsertContact(lead: LeadData): Promise<string> {
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
      // Update existing contact with latest info
      await hubspotFetch(`/crm/v3/objects/contacts/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          properties: {
            firstname: lead.name.split(' ')[0],
            lastname: lead.name.split(' ').slice(1).join(' ') || '',
            company: lead.organization,
            jobtitle: lead.role || '',
            state: lead.state || '',
          },
        }),
      });
      return contactId;
    }
  } catch (e: any) {
    // Search failed — fall through to create
    console.warn('[HubSpot] Contact search failed, creating new:', e.message);
  }

  // Create new contact
  const contact = await hubspotFetch('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        email: lead.email,
        firstname: lead.name.split(' ')[0],
        lastname: lead.name.split(' ').slice(1).join(' ') || '',
        company: lead.organization,
        jobtitle: lead.role || '',
        state: lead.state || '',
        hs_lead_status: 'NEW',
        lifecyclestage: 'lead',
      },
    }),
  });

  return contact.id;
}

/**
 * Create a deal and associate it with the contact.
 * Deal name: "{Organization} - {State} Program Interest"
 * Includes program parameters in deal properties/notes.
 */
async function createDeal(
  contactId: string,
  lead: LeadData,
  programData?: ProgramData,
): Promise<string> {
  const stateName = lead.state || 'Unknown';
  const dealName = `${lead.organization} — ${stateName} Program Interest`;

  // Build deal description with program parameters
  const descLines = [
    `Lead from explore.homium.io`,
    `Contact: ${lead.name} (${lead.email})`,
    `Organization: ${lead.organization}`,
    lead.role ? `Role: ${lead.role}` : '',
    lead.state ? `State of Interest: ${lead.state}` : '',
    '',
  ];

  if (programData && Object.keys(programData).length > 0) {
    descLines.push('--- Program Parameters ---');
    for (const [key, value] of Object.entries(programData)) {
      if (value !== undefined && value !== null) {
        descLines.push(`${key}: ${typeof value === 'number' ? value.toLocaleString() : value}`);
      }
    }
  }

  if (lead.utmSource || lead.utmMedium || lead.utmCampaign) {
    descLines.push('', '--- Attribution ---');
    if (lead.utmSource) descLines.push(`Source: ${lead.utmSource}`);
    if (lead.utmMedium) descLines.push(`Medium: ${lead.utmMedium}`);
    if (lead.utmCampaign) descLines.push(`Campaign: ${lead.utmCampaign}`);
  }

  const properties: Record<string, string> = {
    dealname: dealName,
    description: descLines.filter(Boolean).join('\n'),
    dealstage: HUBSPOT_STAGE_ID,
    pipeline: HUBSPOT_PIPELINE_ID,
  };

  if (programData?.totalRaise) {
    properties.amount = String(programData.totalRaise);
  }

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
 * Main entry point — called from usage-routes when a lead_submitted event fires.
 * Runs async, does not block the API response.
 */
export async function syncLeadToHubSpot(
  lead: LeadData,
  programData?: ProgramData,
): Promise<{ contactId: string; dealId: string } | null> {
  if (!HUBSPOT_TOKEN) {
    console.warn('[HubSpot] No HUBSPOT_API_TOKEN configured — skipping sync');
    return null;
  }
  if (!HUBSPOT_PIPELINE_ID || !HUBSPOT_STAGE_ID) {
    console.warn('[HubSpot] HUBSPOT_PIPELINE_ID or HUBSPOT_STAGE_ID not set — skipping sync');
    return null;
  }

  try {
    const contactId = await upsertContact(lead);
    const dealId = await createDeal(contactId, lead, programData);
    console.log(`[HubSpot] Synced lead ${lead.email} → contact=${contactId}, deal=${dealId}`);
    return { contactId, dealId };
  } catch (e: any) {
    console.error('[HubSpot] Sync failed:', e.message);
    return null;
  }
}

/**
 * Utility: list pipelines (for initial setup / debugging).
 * Call via: GET /api/v2/usage/hubspot/pipelines
 */
export async function listPipelines(): Promise<any> {
  if (!HUBSPOT_TOKEN) throw new Error('HUBSPOT_API_TOKEN not configured');
  return hubspotFetch('/crm/v3/pipelines/deals');
}
