'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { tasksApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import CreateTaskModal from '@/components/CreateTaskModal';
import { SkeletonRows } from '@/components/Skeleton';
import { CategoryBadge, EmptyState, formatMoney, Panel, StatCard, StatusBadge } from '@/components/ui';
import type { Task } from '@/lib/types';

export default function ClientHome() {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [taskList, statCounts] = await Promise.all([tasksApi.mine(), tasksApi.stats()]);
      setTasks(taskList);
      setStats(statCounts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openTasks = tasks.filter((t) => t.status === 'open').length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">Manage your tasks</h2>
          <p className="mt-1 text-sm text-neutral-500">Post work, review applicants, and release payments.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary self-start">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create task
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tasks posted" value={tasks.length} delay={100} tone="primary" />
        <StatCard label="In progress" value={stats.in_progress ?? 0} delay={200} tone="warning" />
        <StatCard label="Completed" value={stats.completed ?? 0} delay={300} tone="success" />
        <StatCard label="Disputed" value={stats.disputed ?? 0} delay={100} tone="accent" />
      </div>

      {/* Content split */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main: tasks */}
        <div className="lg:col-span-2">
          <Panel
            title="Your tasks"
            action={<span className="text-xs text-neutral-500">{openTasks} open</span>}
          >
            {loading ? (
              <SkeletonRows rows={4} />
            ) : tasks.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No tasks yet"
                  subtitle="Post your first task and start receiving applications from freelancers."
                  action={
                    <button onClick={() => setModalOpen(true)} className="btn-primary">
                      Create your first task
                    </button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-neutral-200">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/dashboard/task-detail/${task.id}`}
                      className="flex items-center gap-4 px-5 py-4 transition hover:bg-neutral-100"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-neutral-900">{task.title}</p>
                          <CategoryBadge category={task.category} />
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {task.applicant_count ?? 0} applicant{(task.applicant_count ?? 0) === 1 ? '' : 's'} ·{' '}
                          {new Date(task.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={task.status} />
                      <span className="font-display shrink-0 text-sm font-semibold text-neutral-900">{formatMoney(task.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <Panel title="Quick actions" bodyClassName="p-3">
            <div className="space-y-1">
              <RailLink href="/dashboard/applications" label="Review applicants" icon="inbox" />
              <RailLink href="/dashboard/contracts" label="Contracts & escrow" icon="wallet" />
              <RailLink href="/dashboard/disputes" label="Disputes" icon="scale" />
            </div>
          </Panel>

          <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-5">
            <div aria-hidden className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
            <h4 className="font-display relative text-sm font-semibold text-neutral-900">How escrow protects you</h4>
            <p className="relative mt-2 text-xs leading-relaxed text-neutral-700">
              Funds you pay are held securely and only released to the freelancer once you approve the delivered work.
            </p>
          </div>
        </div>
      </div>

      <CreateTaskModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => load()} />
    </div>
  );
}

const railIcons: Record<string, string> = {
  inbox: 'M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z',
  wallet: 'M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3',
  scale: 'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.032-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971z'
};

function RailLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d={railIcons[icon]} />
        </svg>
      </span>
      <span className="flex-1">{label}</span>
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4 text-neutral-400">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}
