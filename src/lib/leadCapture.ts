/**
 * Lead capture submission to Google Sheets via Apps Script.
 * Uses mode: 'no-cors' + Content-Type: text/plain with JSON body
 * (the proven pattern for Apps Script endpoints).
 */

export interface LeadInfo {
  name: string
  email: string
  organization: string
  role?: string
  state?: string
  timestamp?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

// Replace with your deployed Apps Script web app URL
const APPS_SCRIPT_URL = import.meta.env.VITE_LEAD_CAPTURE_URL || ''

export async function submitToGoogleSheets(lead: LeadInfo): Promise<void> {
  const payload: LeadInfo = {
    ...lead,
    timestamp: new Date().toISOString(),
    utm_source: getUTM('utm_source'),
    utm_medium: getUTM('utm_medium'),
    utm_campaign: getUTM('utm_campaign'),
  }

  if (!APPS_SCRIPT_URL) {
    console.warn('[Lead Capture] No VITE_LEAD_CAPTURE_URL configured — logging to console')
    console.log('[Lead Capture]', payload)
    return
  }

  await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  })
}

function getUTM(param: string): string {
  try {
    return new URL(window.location.href).searchParams.get(param) || ''
  } catch {
    return ''
  }
}
