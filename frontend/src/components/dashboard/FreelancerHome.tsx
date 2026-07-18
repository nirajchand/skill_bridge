'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { contractsApi, tasksApi, type TaskFilters } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { CategoryBadge, EmptyState, formatMoney, Panel, Spinner, StatCard, StatusBadge } from '@/components/ui';
import type { Contract, Task } from '@/lib/types';

const categories = ['', 'writing', 'design', 'development', 'marketing', 'data', 'other'];
const sorts = [
  { value: 'recent', label: 'Most recent' },
  { value: 'price_high', label: 'Highest price' },
  { value: 'price_low', label: 'Lowest price' },
  { value: 'applications', label: 'Most applications' }
];

const controlClass =
  'rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100';

export default function FreelancerHome() {
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('recent');

  const load = useCallback(
    async (filters: TaskFilters) => {
      setLoading(true);
      try {
        const [taskList, contractList] = await Promise.all([tasksApi.browse(filters), contractsApi.list()]);
        setTasks(taskList);
        setContracts(contractList);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Debounced search + filter changes.
  useEffect(() => {
    const id = setTimeout(() => load({ search, category, sort }), 300);
    return () => clearTimeout(id);
  }, [search, category, sort, load]);

  const active = contracts.filter((c) => ['pending', 'in_progress', 'submitted'].includes(c.status));
  const completed = contracts.filter((c) => c.status === 'completed').length;
  const earned = contracts
    .filter((c) => c.escrow_status === 'released')
    .reduce((sum, c) => sum + Number(c.agreed_price), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">Find your next project</h2>
        <p className="mt-1 text-sm text-neutral-500">Browse open tasks and track your active contracts.</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Available tasks" value={tasks.length} delay={100} tone="info" />
        <StatCard label="Active contracts" value={active.length} delay={200} tone="primary" />
        <StatCard label="Completed" value={completed} delay={300} tone="success" />
        <StatCard label="Earned" value={formatMoney(earned)} delay={100} tone="accent" />
      </div>

      {/* Content split */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main: browse */}
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Browse tasks" bodyClassName="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  className={`${controlClass} w-full pl-9`}
                  placeholder="Search tasks…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select className={`${controlClass} capitalize`} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c || 'all'} value={c} className="bg-neutral-50 capitalize">
                    {c || 'All categories'}
                  </option>
                ))}
              </select>
              <select className={controlClass} value={sort} onChange={(e) => setSort(e.target.value)}>
                {sorts.map((s) => (
                  <option key={s.value} value={s.value} className="bg-neutral-50">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </Panel>

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState title="No matching tasks" subtitle="Try adjusting your search or filters." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/dashboard/task-detail/${task.id}`}
                  className="group flex flex-col rounded-2xl border border-neutral-200 bg-gradient-to-b from-neutral-50 to-transparent p-5 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:from-neutral-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-sm font-semibold text-neutral-900">{task.title}</h3>
                    <span className="font-display shrink-0 text-sm font-semibold text-emerald-700">{formatMoney(task.price)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-neutral-600">{task.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <CategoryBadge category={task.category} />
                    <span className="text-xs text-neutral-500">
                      {task.applicant_count ?? 0} applicant{(task.applicant_count ?? 0) === 1 ? '' : 's'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <Panel
            title="Active contracts"
            action={
              <Link href="/dashboard/contracts" className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
                View all
              </Link>
            }
          >
            {active.length === 0 ? (
              <p className="px-5 py-6 text-sm text-neutral-500">No active contracts yet. Apply to tasks to get started.</p>
            ) : (
              <ul className="divide-y divide-neutral-200">
                {active.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{c.task_title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{formatMoney(c.agreed_price)}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-500/15 to-cyan-500/5 p-5">
            <div aria-hidden className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
            <h4 className="font-display relative text-sm font-semibold text-neutral-900">Get paid faster</h4>
            <p className="relative mt-2 text-xs leading-relaxed text-neutral-700">
              A complete profile with skills and a portfolio gets more hires. Track your balance on the Earnings page.
            </p>
            <Link href="/dashboard/earnings" className="relative mt-3 inline-block text-xs font-medium text-emerald-700 hover:text-emerald-800">
              Go to Earnings →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
