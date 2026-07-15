'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function ProfileNudge() {
  const pathname = usePathname();
  const { profile } = useAuth();

  const pct = profile?.profile_completion_percentage ?? 100;
  // Hide when complete, still loading, or already on the settings page.
  if (!profile || pct >= 100 || pathname === '/dashboard/settings') return null;

  return (
    <div className="mx-auto mb-6 max-w-5xl">
      <div className="flex flex-col gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0">
            <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="rgb(129,140,248)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 94.2} 94.2`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-indigo-200">{pct}%</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Your profile is {pct}% complete</p>
            <p className="text-xs text-neutral-400">Complete it to attract better opportunities.</p>
          </div>
        </div>
        <Link
          href="/dashboard/settings"
          className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-neutral-200"
        >
          Complete profile
        </Link>
      </div>
    </div>
  );
}
