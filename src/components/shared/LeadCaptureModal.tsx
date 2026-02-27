import { H2, Body } from '../../design-system/Typography'
import LeadCaptureForm from './LeadCaptureForm'
import type { LeadInfo } from '../../lib/leadCapture'

interface Props {
  onSubmit: (info: LeadInfo) => Promise<void>
  prefilledState?: string
}

export default function LeadCaptureModal({ onSubmit, prefilledState }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-dark/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <img src="/homium-wordmark.svg" alt="Homium" className="h-6 mx-auto mb-4" />
          <H2>Your Program Analysis is Ready</H2>
          <Body className="mt-2">
            Enter your details to view your 30-year program projections, borrower impact analysis,
            and export a PDF report.
          </Body>
        </div>

        <LeadCaptureForm
          onSubmit={onSubmit}
          prefilledState={prefilledState}
          submitLabel="View Your Program Analysis"
        />

        <p className="font-body text-[11px] text-lightGray text-center mt-4 leading-relaxed">
          Your information is used only to share relevant program insights.
          We never sell your data.
        </p>
      </div>
    </div>
  )
}
