import type { ReactNode } from 'react';

// A titled panel used to divide the dashboard into clear sections.
export function Panel({
  title,
  action,
  children,
  className = '',
  bodyClassName = ''
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5">
          <h3 className="font-display text-sm font-semibold text-neutral-900">{title}</h3>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function formatMoney(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '$0';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export type TabDef<T extends string> = { key: T; label: string; count: number; tone?: 'brand' | 'amber' | 'rose' };

/**
 * Segmented filter tabs with live counts.
 *
 * Counts sit in the tab itself so a user can see "2 need my attention" without
 * clicking through each section — the whole point of splitting the list up.
 * Zero-count tabs stay visible (rather than disappearing) so the set of options
 * doesn't shift around under the cursor as data changes.
 */
export function FilterTabs<T extends string>({
  tabs,
  active,
  onChange
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (key: T) => void;
}) {
  const badgeTone = (tone: TabDef<T>['tone'], isActive: boolean) => {
    if (isActive) return 'bg-white/20 text-white';
    if (tone === 'amber') return 'bg-amber-100 text-amber-700';
    if (tone === 'rose') return 'bg-rose-100 text-rose-700';
    return 'bg-neutral-200 text-neutral-600';
  };

  return (
    <div
      role="tablist"
      aria-label="Filter"
      className="flex flex-wrap gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-1.5"
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              isActive ? 'bg-brand-600 text-white shadow-card' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${badgeTone(t.tone, isActive)}`}>
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const statusTones: Record<string, string> = {
  open: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  submitted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  disputed: 'bg-rose-50 text-rose-700 ring-rose-200',
  cancelled: 'bg-neutral-100 text-neutral-500 ring-neutral-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  withdrawn: 'bg-neutral-100 text-neutral-500 ring-neutral-200',
  funded: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  not_funded: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
  released: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  refunded: 'bg-amber-50 text-amber-700 ring-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  escalated: 'bg-rose-50 text-rose-700 ring-rose-200'
};

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTones[status] ?? 'bg-neutral-100 text-neutral-600 ring-neutral-200';
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${tone}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export type StatTone = 'primary' | 'accent' | 'success' | 'warning' | 'info' | 'neutral';

/**
 * Stat tones for the LIGHT theme.
 *
 * On white, the old heavy /25 washes turned muddy, and pink/orange/sky fought the
 * green brand. These are soft 50-tints from a green-led palette: brand green for
 * the primary metric, teal/lime as sibling greens, with amber and rose kept ONLY
 * where they carry meaning (warning / disputes) — colour should encode state, not
 * decorate.
 */
const statTones: Record<StatTone, { grad: string; ring: string; glow: string }> = {
  primary: { grad: 'from-brand-50 to-white', ring: 'ring-brand-200', glow: 'bg-brand-300/40' },
  accent: { grad: 'from-teal-50 to-white', ring: 'ring-teal-200', glow: 'bg-teal-300/40' },
  success: { grad: 'from-emerald-50 to-white', ring: 'ring-emerald-200', glow: 'bg-emerald-300/40' },
  warning: { grad: 'from-amber-50 to-white', ring: 'ring-amber-200', glow: 'bg-amber-300/40' },
  info: { grad: 'from-lime-50 to-white', ring: 'ring-lime-200', glow: 'bg-lime-300/40' },
  neutral: { grad: 'from-neutral-50 to-white', ring: 'ring-neutral-200', glow: 'bg-neutral-200/60' }
};

export function StatCard({
  label,
  value,
  hint,
  delay,
  tone = 'neutral',
  icon
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  delay?: number;
  tone?: StatTone;
  icon?: ReactNode;
}) {
  const t = statTones[tone];
  return (
    <div
      className={`animate-fade-in-up group relative overflow-hidden rounded-2xl bg-gradient-to-br ${t.grad} p-5 ring-1 ${t.ring} transition duration-300 hover:-translate-y-0.5 ${
        delay ? `delay-${delay}` : ''
      }`}
    >
      <div className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl ${t.glow} opacity-60 transition group-hover:opacity-100`} />
      <div className="relative flex items-start justify-between">
        <p className="text-xs font-medium text-neutral-700">{label}</p>
        {icon && <span className="text-neutral-700/80">{icon}</span>}
      </div>
      <p className="font-display relative mt-3 text-2xl font-semibold text-neutral-900">{value}</p>
      {hint && <p className="relative mt-1 text-xs text-neutral-600">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="font-medium text-neutral-700">{title}</p>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-neutral-500">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  // Default is for a LIGHT surface: a green head on a grey track. Callers placing
  // a spinner inside a solid brand button override this with border-t-white.
  return <span className={`inline-block animate-spin rounded-full border-2 border-neutral-200 border-t-brand-600 ${className}`} />;
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium capitalize text-neutral-600">
      {category}
    </span>
  );
}
