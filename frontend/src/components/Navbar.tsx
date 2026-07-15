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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/30">
            S
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-white">SkillBridge</span>
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg px-4 py-2 text-neutral-300 transition hover:text-white"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-lg px-4 py-2 text-neutral-300 transition hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-lg px-4 py-2 text-neutral-300 transition hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="rounded-lg bg-white px-4 py-2 font-medium text-black transition hover:bg-neutral-200"
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
