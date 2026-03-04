/** Payoff schedule generator using log-normal PDF shape */

import type { PayoffEntry } from './types';

export interface PayoffPreset {
  label: string;
  peakYear: number;
  concentration: number;
}

export const PAYOFF_PRESETS: PayoffPreset[] = [
  { label: 'Early', peakYear: 7, concentration: 0.6 },
  { label: 'Moderate', peakYear: 12, concentration: 0.5 },
  { label: 'Long-term', peakYear: 18, concentration: 0.4 },
];

/**
 * Generate a 30-year payoff schedule using a log-normal distribution shape.
 * @param peakYear - The year with highest exit probability (maps to mode of log-normal)
 * @param concentration - 0..1, higher = more concentrated around peak (maps to 1/sigma)
 */
export function generatePayoffSchedule(peakYear: number, concentration: number): PayoffEntry[] {
  // Map concentration (0-1) to sigma: high concentration = low sigma
  const sigma = 0.3 + (1 - concentration) * 0.8; // range: 0.3 (tight) to 1.1 (spread)
  // From log-normal mode formula: mode = exp(mu - sigma^2), so mu = ln(mode) + sigma^2
  const mu = Math.log(Math.max(peakYear, 1)) + sigma * sigma;

  // Generate raw log-normal PDF values for years 1-30
  const raw: number[] = [];
  for (let yr = 1; yr <= 30; yr++) {
    const lnX = Math.log(yr);
    const exponent = -((lnX - mu) ** 2) / (2 * sigma * sigma);
    const pdf = (1 / (yr * sigma * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
    raw.push(pdf);
  }

  // Normalize so they sum to 1.0
  const sum = raw.reduce((a, b) => a + b, 0);
  const normalized = raw.map(v => v / sum);

  // Build PayoffEntry[] with cumulative
  let cumulative = 0;
  return normalized.map((pct, i) => {
    cumulative += pct;
    return {
      year: i + 1,
      annualPct: Math.round(pct * 10000) / 10000,
      cumulativePct: Math.min(Math.round(cumulative * 10000) / 10000, 1.0),
    };
  });
}
