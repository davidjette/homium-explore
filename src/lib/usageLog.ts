/**
 * Usage event logger — fire-and-forget POST to /api/v2/usage
 *
 * Sends structured events tied to a persistent anonymous session ID.
 * When lead info exists in localStorage, it's attached so the backend
 * can link anonymous browsing to identified leads.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const SESSION_KEY = 'homium_session_id'

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

function getUTM(param: string): string | undefined {
  try {
    return new URLSearchParams(window.location.search).get(param) || undefined
  } catch {
    return undefined
  }
}

function getLeadInfo(): { email?: string; organization?: string; name?: string; state?: string } | null {
  try {
    return JSON.parse(localStorage.getItem('homium_lead_info') || 'null')
  } catch {
    return null
  }
}

export function logUsage(eventType: string, eventData?: Record<string, unknown>) {
  const sessionId = getSessionId()
  const leadInfo = getLeadInfo()

  fetch(`${API_BASE}/v2/usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      eventType,
      eventData,
      leadEmail: leadInfo?.email,
      leadOrg: leadInfo?.organization,
      leadName: leadInfo?.name,
      state: (eventData?.state as string) || leadInfo?.state,
      utmSource: getUTM('utm_source'),
      utmMedium: getUTM('utm_medium'),
      utmCampaign: getUTM('utm_campaign'),
    }),
  }).catch(() => {}) // fire-and-forget
}
