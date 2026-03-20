/**
 * Profile Setup Modal
 *
 * Shown after first OAuth sign-in to collect name + organization.
 * Replaces the old LeadCaptureModal as the funnel entry point.
 */
import { useState } from 'react';
import { H2, Body } from '../../design-system/Typography';
import { Button } from '../../design-system/Button';
import { useAuthContext } from './AuthProvider';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function ProfileSetupModal() {
  const { user, session, fetchProfile } = useAuthContext();
  const [name, setName] = useState(user?.user_metadata?.full_name || '');
  const [organization, setOrganization] = useState('');
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
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <img src={import.meta.env.BASE_URL + 'homium-wordmark.svg'} alt="Homium" className="h-6 mx-auto mb-4" />
          <H2>Complete Your Profile</H2>
          <Body className="mt-2">
            Tell us a bit about yourself to get started with Homium Explorer.
          </Body>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-body text-sm font-medium text-dark mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
              placeholder="Your full name"
              required
            />
          </div>

          <div>
            <label className="block font-body text-sm font-medium text-dark mb-1">Organization</label>
            <input
              type="text"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
              placeholder="Company or organization"
            />
          </div>

          <div>
            <label className="block font-body text-sm font-medium text-dark mb-1">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm bg-gray-50 text-lightGray"
            />
          </div>

          {error && (
            <p className="font-body text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Saving...' : 'Get Started'}
          </Button>
        </form>

        <p className="font-body text-[11px] text-lightGray text-center mt-4 leading-relaxed">
          Your information is used only to personalize your experience.
          We never sell your data.
        </p>
      </div>
    </div>
  );
}
