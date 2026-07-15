'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import ProfileAvatar from '@/components/ProfileAvatar';

export default function DashboardTopbar() {
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const toast = useToast();

  const handleLogout = () => {
    logout();
    toast.info('You have been signed out');
    router.push('/');
  };

  const roleLabel = user?.role === 'freelancer' ? 'Freelancer' : 'Client';
  const name = profile?.display_name ?? user?.email?.split('@')[0] ?? 'there';

  return (
    <header className="sticky top-3 z-30 flex items-center justify-between rounded-2xl border border-white/10 bg-neutral-950/70 px-6 py-4 backdrop-blur-xl">
      <div>
        <h1 className="font-display text-lg font-semibold text-white">Dashboard</h1>
        <p className="text-xs text-neutral-500">Welcome back, {name}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
          {roleLabel}
        </span>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-neutral-300 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
        >
          Logout
        </button>
        <Link href="/dashboard/settings" title="Profile settings" className="rounded-full ring-2 ring-transparent transition hover:ring-white/20">
          <ProfileAvatar name={name} src={profile?.profile_image_url} size="md" />
        </Link>
      </div>
    </header>
  );
}
