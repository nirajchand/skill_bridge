'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { paymentsApi, type Earnings, type Payout } from '@/lib/api';
import { EmptyState, formatMoney, Spinner, StatCard, StatusBadge, type StatTone } from '@/components/ui';

export default function EarningsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  // Freelancer-only page.
  useEffect(() => {
    if (user && user.role !== 'freelancer') router.replace('/dashboard');
  }, [user, router]);

  const load = useCallback(async () => {
    try {
      const [e, p] = await Promise.all([paymentsApi.earnings(), paymentsApi.payouts()]);
      setEarnings(e);
      setPayouts(p);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load earnings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user?.role === 'freelancer') load();
  }, [user, load]);

  const requestPayout = async () => {
    setRequesting(true);
    try {
      const payout = await paymentsApi.requestPayout();
      toast.success(`Payout of ${formatMoney(payout.amount)} processed!`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payout failed');
    } finally {
      setRequesting(false);
    }
  };

  if (loading || !earnings) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const cards = [
    { label: 'Total earned', value: earnings.total_earned, tone: 'success' as StatTone },
    { label: 'This month', value: earnings.this_month, tone: 'warning' as StatTone },
    { label: 'Pending (in escrow)', value: earnings.pending_payout, tone: 'info' as StatTone, hint: 'Released when clients approve work' },
    { label: 'Available to withdraw', value: earnings.available_to_withdraw, tone: 'accent' as StatTone }
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white">Earnings</h2>
        <p className="mt-1 text-sm text-neutral-500">Track what you&apos;ve earned and withdraw available funds.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c, i) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={formatMoney(c.value)}
            hint={c.hint}
            tone={c.tone}
            delay={(i % 3) * 100 + 100}
          />
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div>
          <p className="text-sm font-medium text-white">Withdraw your balance</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {earnings.available_to_withdraw > 0
              ? `${formatMoney(earnings.available_to_withdraw)} available to withdraw now.`
              : 'No funds available to withdraw yet.'}
          </p>
        </div>
        <button
          onClick={requestPayout}
          disabled={requesting || earnings.available_to_withdraw <= 0}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-50"
        >
          {requesting && <Spinner className="h-4 w-4 border-black/30 border-t-black" />}
          Request payout
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="border-b border-white/5 px-5 py-4">
          <h3 className="font-display text-sm font-semibold text-white">Payout history</h3>
        </div>
        {payouts.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No payouts yet" subtitle="Your withdrawals will appear here." />
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-white">{formatMoney(p.amount)}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{new Date(p.requested_at).toLocaleString()}</p>
                </div>
                <StatusBadge status={p.payout_status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-neutral-600">
        Payouts are simulated in this environment (no Stripe Connect bank transfer). Escrow funding and charges are real Stripe test payments.
      </p>
    </div>
  );
}
