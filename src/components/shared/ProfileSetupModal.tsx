/**
 * Profile Setup Modal
 *
 * Shown after first OAuth sign-in to collect name, organization,
 * and program interest details (timing, funding, geography, program type).
 */
import { useState } from 'react';
import { H2, Body } from '../../design-system/Typography';
import { Button } from '../../design-system/Button';
import { useAuthContext } from './AuthProvider';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const inputClass = 'w-full border border-border rounded-lg px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green';
const selectClass = `${inputClass} bg-white`;
const labelClass = 'block font-body text-sm font-medium text-dark mb-1';

export default function ProfileSetupModal() {
  const { user, session, fetchProfile } = useAuthContext();
  const [name, setName] = useState(user?.user_metadata?.full_name || '');
  const [organization, setOrganization] = useState('');
  const [timing, setTiming] = useState('');
  const [fundingRange, setFundingRange] = useState('');
  const [geographicFocus, setGeographicFocus] = useState('');
  const [programType, setProgramType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const resp = await fetch(`${API_BASE}/users/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          organization: organization.trim() || null,
          avatar_url: user?.user_metadata?.avatar_url || null,
          timing: timing || null,
          funding_range: fundingRange || null,
          geographic_focus: geographicFocus.trim() || null,
          program_type: programType || null,
        }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save profile');
      }

      // Refresh profile in auth context
      if (session?.access_token) {
        await fetchProfile(session.access_token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-dark/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <img src={import.meta.env.BASE_URL + 'homium-wordmark.svg'} alt="Homium" className="h-6 mx-auto mb-4" />
          <H2>Complete Your Profile</H2>
          <Body className="mt-2">
            Tell us about yourself and what you're exploring so we can tailor your experience.
          </Body>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* About You */}
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputClass}
              placeholder="Your full name"
              required
            />
          </div>

          <div>
            <label className={labelClass}>Organization</label>
            <input
              type="text"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
              className={inputClass}
              placeholder="Company or organization"
            />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm bg-gray-50 text-lightGray"
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 pt-2">
            <div className="flex-1 h-px bg-border" />
            <span className="font-body text-xs text-lightGray uppercase tracking-wider">Program Interest</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div>
            <label className={labelClass}>Timing</label>
            <select
              value={timing}
              onChange={e => setTiming(e.target.value)}
              className={selectClass}
            >
              <option value="">Select timing...</option>
              <option value="immediate">Immediate (within 3 months)</option>
              <option value="near-term">Near-term (3–12 months)</option>
              <option value="exploratory">Exploratory (12+ months or just learning)</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Potential Funding Range</label>
            <select
              value={fundingRange}
              onChange={e => setFundingRange(e.target.value)}
              className={selectClass}
            >
              <option value="">Select range...</option>
              <option value="under-5m">Under $5M</option>
              <option value="5m-25m">$5M – $25M</option>
              <option value="25m-100m">$25M – $100M</option>
              <option value="100m-plus">$100M+</option>
              <option value="unsure">Not sure yet</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Geographic Focus</label>
            <input
              type="text"
              value={geographicFocus}
              onChange={e => setGeographicFocus(e.target.value)}
              className={inputClass}
              placeholder="e.g. Utah, Southeast US, National"
            />
          </div>

          <div>
            <label className={labelClass}>Program Type</label>
            <select
              value={programType}
              onChange={e => setProgramType(e.target.value)}
              className={selectClass}
            >
              <option value="">Select type...</option>
              <option value="new">New program</option>
              <option value="existing">Existing program (expanding or optimizing)</option>
              <option value="research">Research only</option>
            </select>
          </div>

          {error && (
            <p className="font-body text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Saving...' : 'Get Started'}
          </Button>
        </form>

        <p className="font-body text-[11px] text-lightGray text-center mt-4 leading-relaxed">
          All fields except name are optional. Your information is used only to personalize your experience.
          We never sell your data.
        </p>
      </div>
    </div>
  );
}
