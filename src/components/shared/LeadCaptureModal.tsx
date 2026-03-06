import { H2, Body } from '../../design-system/Typography'
import LeadCaptureForm from './LeadCaptureForm'
import type { LeadInfo } from '../../lib/leadCapture'

interface Props {
  onSubmit: (info: LeadInfo) => Promise<void>
  prefilledState?: string
  onClose?: () => void
}

export default function LeadCaptureModal({ onSubmit, prefilledState, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-dark/60 backdrop-blur-sm p-4"
      onClick={onClose ? (e) => { if (e.target === e.currentTarget) onClose() } : undefined}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray hover:text-dark transition-colors text-xl leading-none cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        )}
        <div className="text-center mb-6">
          <img src={import.meta.env.BASE_URL + 'homium-wordmark.svg'} alt="Homium" className="h-6 mx-auto mb-4" />
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
