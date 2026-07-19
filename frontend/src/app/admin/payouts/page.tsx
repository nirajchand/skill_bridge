'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi, type AdminPayout } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { EmptyState, formatMoney, Spinner, StatusBadge } from '@/components/ui';

export default function AdminPayoutsPage() {
  const toast = useToast();
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPayouts(await adminApi.payouts());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const process = async (id: string) => {
    setBusyId(id);
    try {
      await adminApi.processPayout(id);
      toast.success('Payout processed — funds sent to the freelancer');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process');
    } finally {
      setBusyId(null);
    }
  };

  const pending = payouts.filter((p) => p.payout_status === 'pending');
  const pendingTotal = pending.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-900">Payouts</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {pending.length} pending · {formatMoney(pendingTotal)} to process
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : payouts.length === 0 ? (
        <EmptyState title="No payouts yet" subtitle="Freelancer payout requests appear here." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Freelancer</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Requested</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-100">
                  <td className="px-4 py-3 text-neutral-800">{p.freelancer_email}</td>
                  <td className="px-4 py-3 font-display font-semibold text-neutral-900">{formatMoney(p.amount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.payout_status} /></td>
                  <td className="px-4 py-3 text-neutral-500">{new Date(p.requested_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {p.payout_status === 'pending' && (
                      <button
                        onClick={() => process(p.id)}
                        disabled={busyId === p.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                      >
                        {busyId === p.id && <Spinner className="h-3 w-3 border-white/30 border-t-white" />}
                        Process
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
