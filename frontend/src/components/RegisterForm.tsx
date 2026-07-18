'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { isValidEmail, validatePassword, passwordsMatch, type PasswordStrength } from '@/lib/validation';
import PasswordInput from '@/components/PasswordInput';
import Captcha, { type CaptchaState } from '@/components/Captcha';

const strengthMeta: Record<PasswordStrength, { label: string; color: string; bar: string; width: string }> = {
  weak: { label: 'Weak', color: 'text-rose-600', bar: 'bg-rose-500', width: 'w-1/3' },
  medium: { label: 'Medium', color: 'text-amber-600', bar: 'bg-amber-500', width: 'w-2/3' },
  strong: { label: 'Strong', color: 'text-emerald-600', bar: 'bg-emerald-500', width: 'w-full' }
};

const roles: { value: 'client' | 'freelancer'; title: string; blurb: string }[] = [
  { value: 'client', title: 'Client', blurb: 'Post tasks & hire' },
  { value: 'freelancer', title: 'Freelancer', blurb: 'Find work & earn' }
];

export default function RegisterForm() {
  const router = useRouter();
  const { register, isLoading } = useAuth();
  // Registration is always CAPTCHA-gated server-side, so always collect one.
  const [captcha, setCaptcha] = useState<CaptchaState>({ token: '', answer: '' });
  const toast = useToast();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'client' as 'client' | 'freelancer'
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>('weak');

  const clearError = (key: string) =>
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleEmailBlur = () => {
    if (formData.email && !isValidEmail(formData.email)) {
      setFieldErrors((prev) => ({ ...prev, email: 'Please enter a valid email address' }));
    } else {
      clearError('email');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pwd = e.target.value;
    setFormData((prev) => ({ ...prev, password: pwd }));
    setPasswordStrength(validatePassword(pwd).strength);
  };

  const handlePasswordBlur = () => {
    const validation = validatePassword(formData.password);
    if (formData.password && !validation.valid) {
      setFieldErrors((prev) => ({ ...prev, password: validation.errors.join(' · ') }));
    } else {
      clearError('password');
    }
  };

  const handleConfirmBlur = () => {
    if (formData.confirmPassword && !passwordsMatch(formData.password, formData.confirmPassword)) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }));
    } else {
      clearError('confirmPassword');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!isValidEmail(formData.email)) newErrors.email = 'Please enter a valid email address';
    const pwdCheck = validatePassword(formData.password);
    if (!pwdCheck.valid) newErrors.password = pwdCheck.errors.join(' · ');
    if (!passwordsMatch(formData.password, formData.confirmPassword)) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast.error('Please fix the highlighted fields');
      return;
    }

    try {
      await register(formData.email, formData.password, formData.role, captcha);
      toast.success('Account created! Welcome to SkillBridge 🎉');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const meta = strengthMeta[passwordStrength];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">Create your account</h1>
        <p className="mt-1.5 text-sm text-neutral-500">Join SkillBridge in a few seconds.</p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {/* Role selector */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">I want to join as</label>
          <div className="grid grid-cols-2 gap-3">
            {roles.map((role) => {
              const active = formData.role === role.value;
              return (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, role: role.value }))}
                  className={`rounded-xl border px-4 py-3 text-left transition duration-200 ${
                    active
                      ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100'
                      : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-neutral-100'
                  }`}
                >
                  <span className={`block text-sm font-semibold ${active ? 'text-neutral-900' : 'text-neutral-800'}`}>
                    {role.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">{role.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>

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
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
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
            autoComplete="new-password"
            value={formData.password}
            onChange={handlePasswordChange}
            onBlur={handlePasswordBlur}
            error={fieldErrors.password}
          />
          {formData.password && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Password strength</span>
                <span className={meta.color}>{meta.label}</span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                <div className={`h-full rounded-full transition-all duration-300 ${meta.bar} ${meta.width}`} />
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-400">
                12+ characters with uppercase, lowercase, number &amp; symbol
              </p>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Confirm password
          </label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            onBlur={handleConfirmBlur}
            error={fieldErrors.confirmPassword}
          />
        </div>

        {/* Spec 2.2: blocks automated account creation. */}
        <Captcha onChange={setCaptcha} />

        <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
          {isLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-neutral-500">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-medium text-emerald-600 transition hover:text-emerald-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
