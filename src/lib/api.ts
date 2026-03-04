/** verbose-fiesta API client */

import type {
  HousingStateData,
  HousingCountyData,
  HousingZipData,
  AffordabilityData,
  FundConfig,
  FundModelResult,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: { timestamp: string; compute_time_ms?: number };
  error?: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(body.error || `API error: ${resp.status}`);
  }

  const json: ApiResponse<T> = await resp.json();
  if (!json.success) throw new Error(json.error || 'API returned unsuccessful response');
  return json.data;
}

// ── Housing Data ──

export async function fetchAllStates(): Promise<HousingStateData[]> {
  return apiFetch('/v2/funds/housing/states');
}

export async function fetchStateData(stateAbbr: string): Promise<HousingStateData> {
  return apiFetch(`/v2/funds/housing/state/${stateAbbr.toUpperCase()}`);
}

export async function fetchCountiesByState(stateAbbr: string): Promise<HousingCountyData[]> {
  return apiFetch(`/v2/funds/housing/state/${stateAbbr.toUpperCase()}/counties`);
}

export async function fetchZipsByState(stateAbbr: string): Promise<HousingZipData[]> {
  return apiFetch(`/v2/funds/housing/state/${stateAbbr.toUpperCase()}/zips`);
}

export async function fetchCountyData(stateAbbr: string, county: string): Promise<HousingCountyData> {
  return apiFetch(`/v2/funds/housing/county/${stateAbbr.toUpperCase()}/${encodeURIComponent(county)}`);
}

export async function fetchAffordability(params: {
  state?: string;
  county?: string;
  zip?: string;
  dti?: number;
  rate?: number;
  dp?: number;
  sam?: number;
}): Promise<AffordabilityData> {
  const qs = new URLSearchParams();
  if (params.state) qs.set('state', params.state);
  if (params.county) qs.set('county', params.county);
  if (params.zip) qs.set('zip', params.zip);
  if (params.dti) qs.set('dti', String(params.dti));
  if (params.rate) qs.set('rate', String(params.rate));
  if (params.dp) qs.set('dp', String(params.dp));
  if (params.sam) qs.set('sam', String(params.sam));
  return apiFetch(`/v2/funds/housing/affordability?${qs.toString()}`);
}

// ── Fund Model ──

export async function runFundModel(config: FundConfig): Promise<FundModelResult> {
  return apiFetch('/v2/funds/run', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function autoPopulate(state: string, totalRaise: number = 25_000_000, name?: string): Promise<{
  housingData: { medianIncome: number; medianHomeValue: number };
  fund: FundConfig;
  totalHomeowners: number;
  scenarios: Array<{
    name: string;
    homeowners: number;
    medianIncome: number;
    medianHomeValue: number;
    affordabilityGap: number;
  }>;
  blendedYr10: {
    equityCreated: number;
    activeHomeowners: number;
    roiCumulative: number;
  } | null;
}> {
  return apiFetch('/v2/funds/auto-populate', {
    method: 'POST',
    body: JSON.stringify({ state, totalRaise, name }),
  });
}

// ── Pro Forma PDF ──

export async function downloadProformaPDF(fund: FundConfig, programName?: string): Promise<void> {
  const url = `${API_BASE}/v2/funds/report/pdf`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fund, programName }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(body.error || `PDF generation failed: ${resp.status}`);
  }

  const blob = await resp.blob();
  const filename = resp.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1]
    || `${(programName || 'Homium-Program').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-')}-Pro-Forma.pdf`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// ── Formatting Helpers ──

export function fmtDollar(n: number, decimals = 0): string {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

export function fmtPct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function fmtMultiple(n: number): string {
  return `${n.toFixed(2)}x`;
}

/**
 * Given state market data, find AMI% and SAM% that create an affordability gap
 * Homium can close. Searches outward from 80% AMI to find the closest AMI where
 * a gap exists, then returns the minimum SAM% (10–50%) that closes it.
 */
export function computeSmartDefaults(
  medianIncome: number,
  medianHomePrice: number,
  rate = 0.07,
): { targetAMIPct: number; homiumSAPct: number } {
  const dpPct = 0.03;
  const mr = rate / 12;
  const n = 360;
  const mortgageBefore = medianHomePrice * (1 - dpPct);

  const calcPITI = (principal: number) => {
    const pi = mr === 0 ? principal / n
      : principal * (mr * Math.pow(1 + mr, n)) / (Math.pow(1 + mr, n) - 1);
    return pi + (medianHomePrice * 0.0085) / 12;
  };

  const pitiBefore = calcPITI(mortgageBefore);
  const samSteps = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50];

  // Search outward from 80% AMI: try 80%, then 75%/85%, 70%/90%, etc.
  const amiCandidates: number[] = [0.80];
  for (let d = 0.05; d <= 0.70; d += 0.05) {
    const lo = Math.round((0.80 - d) * 100) / 100;
    const hi = Math.round((0.80 + d) * 100) / 100;
    if (lo >= 0.40) amiCandidates.push(lo);
    if (hi <= 1.50) amiCandidates.push(hi);
  }

  for (const ami of amiCandidates) {
    const maxPITI = (medianIncome * ami * 0.35) / 12;
    if (pitiBefore <= maxPITI) continue; // No gap at this AMI

    // Gap exists — find minimum SAM% that closes it
    for (const sam of samSteps) {
      const pitiAfter = calcPITI(mortgageBefore - medianHomePrice * sam);
      if (pitiAfter <= maxPITI) {
        return { targetAMIPct: ami, homiumSAPct: sam };
      }
    }
    // Even 50% SAM can't fully close at this AMI — try next
  }

  // Fallback: no closeable gap found (extremely cheap market)
  return { targetAMIPct: 0.80, homiumSAPct: 0.20 };
}
