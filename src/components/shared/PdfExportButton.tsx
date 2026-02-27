import { useState } from 'react'
import { Button } from '../../design-system/Button'
import { exportProgramPDF } from '../../lib/pdfExport'
import { trackEvent } from '../../lib/analytics'

interface Props {
  elementId: string
  filename?: string
}

export default function PdfExportButton({ elementId, filename }: Props) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportProgramPDF(elementId, filename)
      trackEvent('pdf_export')
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={exporting}>
      {exporting ? 'Generating PDF...' : 'Export PDF'}
      {!exporting && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
      )}
    </Button>
  )
}
