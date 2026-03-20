/**
 * GA4 analytics wrapper with typed events.
 * GA4 is loaded via index.html script tag.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    __GA_ID?: string
  }
}

type EventName =
  | 'page_view'
  | 'state_selected'
  | 'quick_start_clicked'
  | 'wizard_started'
  | 'wizard_completed'
  | 'model_generated'
  | 'lead_form_shown'
  | 'lead_form_submitted'
  | 'pdf_export'
  | 'excel_export'
  | 'pptx_export'
  | 'cta_click'
  | 'shared_link_loaded'

export function trackEvent(event: EventName, params?: Record<string, string | number | boolean>) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, params)
  }
}

export function trackPageView(path: string, title?: string) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
    })
  }
}
