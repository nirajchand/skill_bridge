'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { applicationsApi, tasksApi } from '@/lib/api';
import { EmptyState, formatMoney, Spinner, StatusBadge } from '@/components/ui';
import type { Application, Task } from '@/lib/types';

function FreelancerApplications() {
  const toast = useToast();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setApps(await applicationsApi.mine());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const withdraw = async (id: string) => {
    setBusyId(id);
    try {
      await applicationsApi.withdraw(id);
      toast.info('Application withdrawn');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const pending = apps.filter((a) => a.status === 'pending');
  const others = apps.filter((a) => a.status !== 'pending');

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white">My applications</h2>
        <p className="mt-1 text-sm text-neutral-500">Track pending bids and see which ones were accepted.</p>
      </div>

      {apps.length === 0 ? (
        <EmptyState
          title="No applications yet"
          subtitle="Browse open tasks and apply to start building contracts."
          action={
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-neutral-200">
              Browse tasks
            </Link>
          }
        />
      ) : (
        <>
          <Section title={`Pending (${pending.length})`}>
            {pending.length === 0 ? (
              <p className="px-5 py-6 text-sm text-neutral-500">No pending applications.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {pending.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/task-detail/${a.task_id}`} className="truncate text-sm font-medium text-neutral-100 hover:text-white">
                        {a.task_title}
                      </Link>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {a.client_email} · {new Date(a.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                    <button
                      onClick={() => withdraw(a.id)}
                      disabled={busyId === a.id}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/5 disabled:opacity-60"
                    >
                      Withdraw
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {others.length > 0 && (
            <Section title="History">
              <ul className="divide-y divide-white/5">
                {others.map((a) => (
                  <li key={a.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/task-detail/${a.task_id}`} className="truncate text-sm font-medium text-neutral-100 hover:text-white">
                        {a.task_title}
                      </Link>
                      <p className="mt-0.5 text-xs text-neutral-500">{a.client_email}</p>
                    </div>
                    <StatusBadge status={a.status} />
                    <span className="font-display shrink-0 text-sm font-semibold text-white">
                      {a.task_price ? formatMoney(a.task_price) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function ClientApplicants() {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tasksApi
      .mine()
      .then(setTasks)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const withApplicants = tasks.filter((t) => (t.applicant_count ?? 0) > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white">Applicants</h2>
        <p className="mt-1 text-sm text-neutral-500">Open a task to review applicants and hire.</p>
      </div>

      {withApplicants.length === 0 ? (
        <EmptyState title="No applicants yet" subtitle="When freelancers apply to your tasks, they’ll show up here." />
      ) : (
        <Section title={`Tasks with applications (${withApplicants.length})`}>
          <ul className="divide-y divide-white/5">
            {withApplicants.map((t) => (
              <li key={t.id}>
                <Link href={`/dashboard/task-detail/${t.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.02]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-100">{t.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {t.applicant_count} applicant{t.applicant_count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                  <span className="font-display shrink-0 text-sm font-semibold text-white">{formatMoney(t.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="border-b border-white/5 px-5 py-4">
        <h3 className="font-display text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function ApplicationsPage() {
  const { user } = useAuth();
  if (!user) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  return user.role === 'freelancer' ? <FreelancerApplications /> : <ClientApplicants />;
}
