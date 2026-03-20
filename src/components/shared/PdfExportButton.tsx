import { useState } from 'react'
import { Button } from '../../design-system/Button'
import { downloadProformaPDF, downloadProformaPptx } from '../../lib/api'
import { trackEvent } from '../../lib/analytics'
import { logUsage } from '../../lib/usageLog'
import type { FundConfig } from '../../lib/types'

interface Props {
  fund: FundConfig
  programName?: string
  includeAffordabilitySensitivity?: boolean
}

export default function PdfExportButton({ fund, programName, includeAffordabilitySensitivity }: Props) {
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingPptx, setExportingPptx] = useState(false)
  const [error, setError] = useState('')

  const handlePdfExport = async () => {
    setExportingPdf(true)
    setError('')
    try {
      await downloadProformaPDF(fund, programName, includeAffordabilitySensitivity)
      trackEvent('pdf_export', { programName: programName || 'unnamed' })
      logUsage('pdf_export', { programName: programName || 'unnamed' })
    } catch (err) {
      console.error('PDF export failed:', err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Export failed: ${msg}`)
    } finally {
      setExportingPdf(false)
    }
  }

  const handlePptxExport = async () => {
    setExportingPptx(true)
    setError('')
    try {
      await downloadProformaPptx(fund, programName, includeAffordabilitySensitivity)
      trackEvent('pptx_export', { programName: programName || 'unnamed' })
      logUsage('pptx_export', { programName: programName || 'unnamed' })
    } catch (err) {
      console.error('PPTX export failed:', err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Export failed: ${msg}`)
    } finally {
      setExportingPptx(false)
    }
  }

  const downloadIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
    </svg>
  )

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="inline-flex gap-2">
        <Button variant="outline" onClick={handlePdfExport} disabled={exportingPdf}>
          {exportingPdf ? 'Generating PDF...' : 'Export PDF'}
          {!exportingPdf && downloadIcon}
        </Button>
        <Button variant="outline" onClick={handlePptxExport} disabled={exportingPptx}>
          {exportingPptx ? 'Generating PPTX...' : 'Export PPTX'}
          {!exportingPptx && downloadIcon}
        </Button>
      </div>
      {error && (
        <p className="font-body text-xs text-red-600 max-w-[200px] text-center">{error}</p>
      )}
    </div>
  )
}
