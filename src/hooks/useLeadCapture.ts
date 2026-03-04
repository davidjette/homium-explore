import { useState, useCallback, useEffect } from 'react'
import { submitToGoogleSheets, type LeadInfo } from '../lib/leadCapture'
import { trackEvent } from '../lib/analytics'

const STORAGE_KEY = 'homium_lead_info'

export function useLeadCapture() {
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const hasWizardResult = !!sessionStorage.getItem('programResult')
  const isGated = !leadInfo && !hasWizardResult

  // Track when gate is shown
  useEffect(() => {
    if (isGated) {
      trackEvent('lead_form_shown')
    }
  }, [isGated])

  const submitLead = useCallback(async (info: LeadInfo) => {
    await submitToGoogleSheets(info)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info))
    setLeadInfo(info)
    trackEvent('lead_form_submitted', {
      organization: info.organization,
      role: info.role || '',
      state: info.state || '',
    })
  }, [])

  return { isGated, leadInfo, submitLead }
}
