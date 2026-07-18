'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { isValidEmail } from '@/lib/validation';
import PasswordInput from '@/components/PasswordInput';
import Captcha, { type CaptchaState } from '@/components/Captcha';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function LoginForm() {
  const router = useRouter();
  const { login, verifyMfa, isLoading } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Only shown once the server reports the account is under attack (spec 2.2).
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaState>({ token: '', answer: '' });

  // The Google button only appears if the server has OAuth credentials
  // configured — otherwise it would be a button that always errors.
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    fetch(`${API_URL}/auth/oauth/status`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGoogleEnabled(!!d.google))
      .catch(() => setGoogleEnabled(false));
  }, []);

  // If Google bounced the user back with an error, surface it.
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get('oauth_error');
    if (err) toast.error(err);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MFA challenge step
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);

  const handleEmailBlur = () => {
    if (email && !isValidEmail(email)) {
      setFieldErrors((prev) => ({ ...prev, email: 'Please enter a valid email address' }));
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.email;
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!isValidEmail(email)) {
      setFieldErrors({ email: 'Please enter a valid email address' });
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      const result = await login(email, password, captchaRequired ? captcha : undefined);
      if (result.mfaRequired && result.mfaToken) {
        setMfaToken(result.mfaToken);
        return; // show the second-factor step
      }
      toast.success('Welcome back! Redirecting…');
      router.push('/dashboard');
    } catch (err) {
      // The server flags when the next attempt needs a CAPTCHA; reveal it here.
      const e = err as Error & { captchaRequired?: boolean };
      if (e.captchaRequired) setCaptchaRequired(true);
      toast.error(e instanceof Error ? e.message : 'Login failed');
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken || !mfaCode.trim()) {
      toast.error('Enter your verification code');
      return;
    }
    try {
      await verifyMfa(mfaToken, mfaCode.trim(), useBackup);
      toast.success('Verified! Redirecting…');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  if (mfaToken) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">Two-factor authentication</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            {useBackup ? 'Enter one of your backup codes.' : 'Enter the 6-digit code from your authenticator app.'}
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleMfaSubmit}>
          <input
            autoFocus
            inputMode={useBackup ? 'text' : 'numeric'}
            className="block w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-lg tracking-widest text-neutral-900 placeholder-neutral-400 outline-none transition focus:border-emerald-500 focus:bg-neutral-50 focus:ring-4 focus:ring-emerald-100"
            placeholder={useBackup ? 'backup code' : '000000'}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {isLoading ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={() => {
              setUseBackup((v) => !v);
              setMfaCode('');
            }}
            className="w-full text-center text-sm text-emerald-600 transition hover:text-emerald-700"
          >
            {useBackup ? 'Use authenticator code instead' : 'Use a backup code'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">Welcome back</h1>
        <p className="mt-1.5 text-sm text-neutral-500">Sign in to continue to your dashboard.</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className={`block w-full rounded-xl border bg-neutral-50 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition duration-200 focus:border-emerald-500 focus:bg-neutral-50 focus:ring-4 focus:ring-emerald-100 ${
              fieldErrors.email ? 'border-rose-400' : 'border-neutral-200'
            }`}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleEmailBlur}
          />
          {fieldErrors.email && <p className="mt-1.5 text-xs text-rose-600">{fieldErrors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Password
          </label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Risk-triggered: only rendered once the server reports repeated
            failures on this account (spec 2.2). Normal logins never see it. */}
        {captchaRequired && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-3 text-xs text-amber-800">
              Several failed attempts were made on this account. Please confirm you&apos;re human.
            </p>
            <Captcha onChange={setCaptcha} />
          </div>
        )}

        {googleEnabled && (
          <>
            <a
              href={`${API_URL}/auth/oauth/google`}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800 transition hover:border-neutral-300 hover:bg-neutral-100"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
                <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 010-4.18V7.07H2.18a11 11 0 000 9.86l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
              </svg>
              Continue with Google
            </a>
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-neutral-100" />
              <span className="text-xs text-neutral-400">or</span>
              <span className="h-px flex-1 bg-neutral-100" />
            </div>
          </>
        )}

        <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
          {isLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-neutral-500">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="font-medium text-emerald-600 transition hover:text-emerald-700">
          Create one
        </Link>
      </p>
    </div>
  );
}
