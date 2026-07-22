'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Profile, User } from '@/lib/types';
import apiClient from '@/lib/api-client';

export type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, captcha?: Captcha) => Promise<LoginResult>;
  verifyMfa: (mfaToken: string, code: string, isBackupCode?: boolean) => Promise<void>;
  register: (email: string, password: string, role: 'client' | 'freelancer', captcha?: Captcha) => Promise<void>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<User | null>;
  refreshProfile: () => Promise<void>;
};

export type Captcha = { token: string; answer: string };
// `captchaRequired` tells the UI to render a challenge on the next attempt.
export type LoginResult = { mfaRequired: boolean; mfaToken?: string; captchaRequired?: boolean };

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  isLoading: false,
  error: null,
  login: async () => ({ mfaRequired: false }),
  verifyMfa: async () => undefined,
  register: async () => undefined,
  logout: async () => undefined,
  getCurrentUser: async () => null,
  refreshProfile: async () => undefined
});

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session lives in httpOnly cookies; ask the server who we are.
  const getCurrentUser = async (): Promise<User | null> => {
    try {
      const response = await apiClient.get('/auth/me');
      return response.data.user as User;
    } catch {
      return null;
    }
  };

  const refreshProfile = async () => {
    try {
      const response = await apiClient.get('/users/me/profile');
      if (response.data?.success) setProfile(response.data.data as Profile);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    getCurrentUser().then(async (currentUser) => {
      if (!mounted) return;
      setUser(currentUser);
      if (currentUser) await refreshProfile();
      setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string, captcha?: Captcha): Promise<LoginResult> => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
        captchaToken: captcha?.token,
        captchaAnswer: captcha?.answer
      });
      // If MFA is enabled, the server withholds the session and returns a challenge.
      if (response.data?.mfaRequired) {
        return { mfaRequired: true, mfaToken: response.data.mfaToken as string };
      }
      // Tokens are set as httpOnly cookies by the server; body carries the user.
      setUser(response.data.user as User);
      await refreshProfile();
      return { mfaRequired: false };
    } catch (err) {
      const message = getErrorMessage(err, 'Login failed');
      setError(message);
      // Surface the server's captchaRequired flag so the form can show a challenge.
      const e = new Error(message) as Error & { captchaRequired?: boolean };
      e.captchaRequired = !!(err as { response?: { data?: { captchaRequired?: boolean } } })?.response?.data
        ?.captchaRequired;
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // Second-factor step: exchange the MFA challenge token + code for a session.
  const verifyMfa = async (mfaToken: string, code: string, isBackupCode = false) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/mfa/verify-login', { mfaToken, code, isBackupCode });
      setUser(response.data.data.user as User);
      await refreshProfile();
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Verification failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, role: 'client' | 'freelancer', captcha?: Captcha) => {
    setError(null);
    setIsLoading(true);

    try {
      await apiClient.post('/auth/register', {
        email,
        password,
        role,
        captchaToken: captcha?.token,
        captchaAnswer: captcha?.answer
      });
      // Registration consumed the CAPTCHA; the follow-up login is a fresh
      // attempt with 0 failures, so it is not gated.
      await login(email, password);
    } catch (err) {
      const message = getErrorMessage(err, 'Registration failed');
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Real logout: revoke the server-side refresh token and clear cookies.
  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      /* clear local state regardless */
    }
    setUser(null);
    setProfile(null);
    setError(null);
  };

  const value = useMemo(
    () => ({ user, profile, isLoading, error, login, verifyMfa, register, logout, getCurrentUser, refreshProfile }),
    [user, profile, isLoading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Turn an axios failure into something worth showing a human.
 *
 * The old version only understood `{ error: string }` and silently fell back to
 * "Login failed" for everything else — so a 429 (throttled) or a dead backend
 * both read as "wrong password", sending users to reset a password that was
 * fine. Each distinct failure now gets its own honest message.
 */
function getErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;

  const e = err as {
    response?: { status?: number; data?: { error?: string; retryAfter?: number } };
    code?: string;
    message?: string;
  };

  // No response at all => the request never reached the API.
  if (!e.response) {
    if (e.code === 'ERR_NETWORK' || e.message === 'Network Error') {
      return 'Cannot reach the server. Is the backend running on port 3001?';
    }
    if (e.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
    return fallback;
  }

  const { status, data } = e.response;

  // Prefer the server's own message — it is written for the user.
  if (data?.error) {
    if (status === 429 && data.retryAfter) {
      return `${data.error} (about ${data.retryAfter}s)`;
    }
    return data.error;
  }

  // A body we can't parse (e.g. a proxy's plain-text 429/502). Explain the
  // status rather than pretending it was a credentials problem.
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status && status >= 500) return 'The server hit an error. Please try again shortly.';

  return fallback;
}

export function useAuth() {
  return useContext(AuthContext);
}
