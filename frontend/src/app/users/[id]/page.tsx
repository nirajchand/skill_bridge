'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { usersApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import ProfileAvatar from '@/components/ProfileAvatar';
import { EmptyState, formatMoney, Spinner } from '@/components/ui';
import type { Profile } from '@/lib/types';

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    usersApi
      .publicProfile(params.id)
      .then(setProfile)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Spinner />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-black px-6 pt-28">
        <div className="mx-auto max-w-2xl">
          <EmptyState title="Profile not found" subtitle="This user does not exist or was removed." />
        </div>
      </div>
    );
  }

  const isFreelancer = profile.role === 'freelancer';
  const isSelf = user?.id === profile.id;

  return (
    <div className="min-h-screen bg-black px-6 pb-20 pt-28 text-neutral-100">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6">
          <div className="flex items-start gap-5">
            <ProfileAvatar name={profile.display_name} src={profile.profile_image_url} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-white">{profile.display_name}</h1>
                {profile.is_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="currentColor" className="h-3 w-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
                <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-medium capitalize text-indigo-300">
                  {profile.role}
                </span>
                {profile.location && <span>· {profile.location}</span>}
              </div>
              {isSelf && (
                <Link href="/dashboard/settings" className="mt-3 inline-block text-xs font-medium text-indigo-400 hover:text-indigo-300">
                  Edit your profile →
                </Link>
              )}
            </div>
          </div>

          {profile.bio && <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">{profile.bio}</p>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <p className="text-xs font-medium text-neutral-500">Completed {isFreelancer ? 'projects' : 'tasks'}</p>
            <p className="font-display mt-2 text-2xl font-semibold text-white">{profile.completed_contracts ?? 0}</p>
          </div>
          {isFreelancer ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-xs font-medium text-neutral-500">Hourly rate</p>
              <p className="font-display mt-2 text-2xl font-semibold text-white">
                {profile.hourly_rate ? `${formatMoney(profile.hourly_rate)}/hr` : '—'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-xs font-medium text-neutral-500">Company</p>
              <p className="font-display mt-2 truncate text-lg font-semibold text-white">{profile.company_name || '—'}</p>
            </div>
          )}
        </div>

        {/* Freelancer detail */}
        {isFreelancer && (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            {profile.skills.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-neutral-300">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((s) => (
                    <span key={s} className="rounded-lg bg-indigo-500/15 px-2.5 py-1 text-xs font-medium text-indigo-200">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {profile.portfolio_url && (
                <a href={profile.portfolio_url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-neutral-200 transition hover:bg-white/5">
                  View portfolio ↗
                </a>
              )}
              {profile.cv_url && (
                <a href={profile.cv_url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-neutral-200 transition hover:bg-white/5">
                  Download CV ↓
                </a>
              )}
            </div>
          </div>
        )}

        {/* Client detail */}
        {!isFreelancer && profile.company_website && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <a href={profile.company_website} target="_blank" rel="noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300">
              {profile.company_website} ↗
            </a>
          </div>
        )}

        <div className="text-center">
          <Link href="/dashboard" className="text-sm text-neutral-500 transition hover:text-neutral-300">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
