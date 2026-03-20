/**
 * SignInModal — Multi-provider sign-in
 *
 * Google OAuth, Microsoft OAuth, email/password with sign-up toggle.
 * Can be used as a modal overlay or inline (no backdrop).
 */
import { useState } from 'react';
import { useAuthContext } from './AuthProvider';
import { Button } from '../../design-system/Button';
import { Body } from '../../design-system/Typography';

interface SignInModalProps {
  /** If true, renders as a modal with backdrop. Otherwise renders inline. */
  modal?: boolean;
  onClose?: () => void;
}

export default function SignInModal({ modal = false, onClose }: SignInModalProps) {
  const {
    signInWithGoogle,
    signInWithMicrosoft,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
  } = useAuthContext();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOAuth = async (provider: 'google' | 'microsoft') => {
    setError('');
    try {
      if (provider === 'google') await signInWithGoogle();
      else await signInWithMicrosoft();
    } catch (e: any) {
      setError(e.message || 'Sign-in failed');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        await resetPassword(email);
        setMessage('Check your email for a password reset link.');
      } else if (mode === 'signup') {
        const { needsConfirmation } = await signUpWithEmail(email, password);
        if (needsConfirmation) {
          setMessage('Check your email to confirm your account before signing in.');
        }
      } else {
        await signInWithEmail(email, password);
        onClose?.();
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="w-full max-w-sm mx-auto">
      {/* OAuth Buttons */}
      <button
        onClick={() => handleOAuth('google')}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-border rounded-lg font-body text-sm font-medium text-dark hover:bg-sectionAlt transition-colors cursor-pointer"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>

      <button
        onClick={() => handleOAuth('microsoft')}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-border rounded-lg font-body text-sm font-medium text-dark hover:bg-sectionAlt transition-colors mt-3 cursor-pointer"
      >
        <svg className="w-5 h-5" viewBox="0 0 21 21">
          <rect x="1" y="1" width="9" height="9" fill="#F25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
          <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
        Continue with Microsoft
      </button>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="font-body text-xs text-lightGray uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Email Form */}
      <form onSubmit={handleEmailSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2.5 border border-border rounded-lg font-body text-sm text-dark placeholder:text-lightGray focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
        />

        {mode !== 'forgot' && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-4 py-2.5 border border-border rounded-lg font-body text-sm text-dark placeholder:text-lightGray focus:outline-none focus:ring-2 focus:ring-green/30 focus:border-green"
          />
        )}

        {error && <p className="font-body text-sm text-red-600">{error}</p>}
        {message && <p className="font-body text-sm text-green">{message}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading
            ? 'Please wait...'
            : mode === 'forgot'
            ? 'Send Reset Link'
            : mode === 'signup'
            ? 'Create Account'
            : 'Sign In'}
        </Button>
      </form>

      {/* Mode Toggle Links */}
      <div className="mt-4 text-center font-body text-sm text-lightGray">
        {mode === 'signin' && (
          <>
            <button onClick={() => { setMode('forgot'); setError(''); setMessage(''); }} className="text-green hover:underline cursor-pointer">
              Forgot password?
            </button>
            <span className="mx-2">&middot;</span>
            <button onClick={() => { setMode('signup'); setError(''); setMessage(''); }} className="text-green hover:underline cursor-pointer">
              Create account
            </button>
          </>
        )}
        {mode === 'signup' && (
          <button onClick={() => { setMode('signin'); setError(''); setMessage(''); }} className="text-green hover:underline cursor-pointer">
            Already have an account? Sign in
          </button>
        )}
        {mode === 'forgot' && (
          <button onClick={() => { setMode('signin'); setError(''); setMessage(''); }} className="text-green hover:underline cursor-pointer">
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );

  if (!modal) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-lightGray hover:text-dark transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-center mb-6">
          <img src={import.meta.env.BASE_URL + 'homium-wordmark.svg'} alt="Homium" className="h-7 mx-auto mb-4" />
          <Body className="text-lightGray">Sign in to continue</Body>
        </div>
        {content}
      </div>
    </div>
  );
}
