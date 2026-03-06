import { useState } from 'react'
import { Button } from '../../design-system/Button'
import { downloadProformaExcel } from '../../lib/api'
import { trackEvent } from '../../lib/analytics'
import type { FundConfig } from '../../lib/types'

interface Props {
  fund: FundConfig
  programName?: string
}

export default function ExcelExportButton({ fund, programName }: Props) {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [useFormulas, setUseFormulas] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      await downloadProformaExcel(fund, programName, useFormulas)
      trackEvent('excel_export', { programName: programName || 'unnamed', mode: useFormulas ? 'formula' : 'values' })
    } catch (err) {
      console.error('Excel export failed:', err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Export failed: ${msg}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <Button variant="outline" onClick={handleExport} disabled={exporting}>
        {exporting ? 'Generating Excel...' : 'Export Excel'}
        {!exporting && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
        )}
      </Button>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={useFormulas}
          onChange={e => setUseFormulas(e.target.checked)}
          className="w-3 h-3 accent-green-700"
        />
        <span className="font-body text-[11px] text-gray-500">Live formulas</span>
      </label>
      {error && (
        <p className="font-body text-xs text-red-600 max-w-[200px] text-center">{error}</p>
      )}
    </div>
  )
}
