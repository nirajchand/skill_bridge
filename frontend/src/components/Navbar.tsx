'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Auth screens and the dashboard render their own chrome.
  if (pathname?.startsWith('/auth') || pathname?.startsWith('/dashboard')) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-500 text-sm font-bold text-neutral-900 shadow-lg shadow-emerald-500/30">
            S
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-neutral-900">SkillBridge</span>
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg px-4 py-2 text-neutral-700 transition hover:text-neutral-900"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-lg px-4 py-2 text-neutral-700 transition hover:text-neutral-900"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-lg px-4 py-2 text-neutral-700 transition hover:text-neutral-900"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
