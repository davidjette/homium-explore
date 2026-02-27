import { useState, type FormEvent } from 'react'
import type { LeadInfo } from '../../lib/leadCapture'
import { Button } from '../../design-system/Button'
import { Label } from '../../design-system/Typography'

const ROLES = [
  'HFA Director',
  'Government Official',
  'University Housing',
  'Health System',
  'Non-profit Leader',
  'Foundation',
  'Other',
]

interface Props {
  onSubmit: (info: LeadInfo) => Promise<void>
  prefilledState?: string
  submitLabel?: string
  className?: string
}

export default function LeadCaptureForm({ onSubmit, prefilledState, submitLabel = 'View Your Program Analysis', className = '' }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [role, setRole] = useState('')
  const [state] = useState(prefilledState || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim() || !email.trim() || !organization.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid work email address.')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({ name: name.trim(), email: email.trim(), organization: organization.trim(), role, state })
    } catch {
      setError('Submission failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="space-y-4">
        <div>
          <Label className="block mb-1.5">Full Name *</Label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full font-body text-dark text-base px-4 py-3 border-[1.5px] border-border rounded-md focus:border-green focus:outline-none"
            required
          />
        </div>

        <div>
          <Label className="block mb-1.5">Work Email *</Label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jane@organization.gov"
            className="w-full font-body text-dark text-base px-4 py-3 border-[1.5px] border-border rounded-md focus:border-green focus:outline-none"
            required
          />
        </div>

        <div>
          <Label className="block mb-1.5">Organization *</Label>
          <input
            type="text"
            value={organization}
            onChange={e => setOrganization(e.target.value)}
            placeholder="State Housing Finance Agency"
            className="w-full font-body text-dark text-base px-4 py-3 border-[1.5px] border-border rounded-md focus:border-green focus:outline-none"
            required
          />
        </div>

        <div>
          <Label className="block mb-1.5">Role (optional)</Label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full font-body text-dark text-base px-4 py-3 border-[1.5px] border-border rounded-md focus:border-green focus:outline-none bg-white appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23555%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
          >
            <option value="">Select...</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <p className="font-body text-sm text-red-600 mt-3">{error}</p>
      )}

      <div className="mt-6">
        <Button size="lg" className="w-full justify-center" disabled={submitting}>
          {submitting ? 'Submitting...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
