'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { isValidEmail } from '@/lib/validation';
import PasswordInput from '@/components/PasswordInput';

export default function LoginForm() {
  const router = useRouter();
  const { login, verifyMfa, isLoading } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      const result = await login(email, password);
      if (result.mfaRequired && result.mfaToken) {
        setMfaToken(result.mfaToken);
        return; // show the second-factor step
      }
      toast.success('Welcome back! Redirecting…');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
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
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white">Two-factor authentication</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            {useBackup ? 'Enter one of your backup codes.' : 'Enter the 6-digit code from your authenticator app.'}
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleMfaSubmit}>
          <input
            autoFocus
            inputMode={useBackup ? 'text' : 'numeric'}
            className="block w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-lg tracking-widest text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-indigo-500/60 focus:bg-white/[0.05] focus:ring-4 focus:ring-indigo-500/10"
            placeholder={useBackup ? 'backup code' : '000000'}
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-60"
          >
            {isLoading ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={() => {
              setUseBackup((v) => !v);
              setMfaCode('');
            }}
            className="w-full text-center text-sm text-indigo-400 transition hover:text-indigo-300"
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
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white">Welcome back</h1>
        <p className="mt-1.5 text-sm text-neutral-500">Sign in to continue to your dashboard.</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-300">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className={`block w-full rounded-xl border bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition duration-200 focus:border-indigo-500/60 focus:bg-white/[0.05] focus:ring-4 focus:ring-indigo-500/10 ${
              fieldErrors.email ? 'border-rose-500/50' : 'border-white/10'
            }`}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleEmailBlur}
          />
          {fieldErrors.email && <p className="mt-1.5 text-xs text-rose-400">{fieldErrors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-300">
            Password
          </label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

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
        <Link href="/auth/register" className="font-medium text-indigo-400 transition hover:text-indigo-300">
          Create one
        </Link>
      </p>
    </div>
  );
}
