'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { disputesApi } from '@/lib/api';
import { EmptyState, Spinner, StatusBadge } from '@/components/ui';
import type { Dispute } from '@/lib/types';

export default function DisputesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    disputesApi
      .list()
      .then(setDisputes)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load disputes'))
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white">Disputes</h2>
        <p className="mt-1 text-sm text-neutral-500">Track disputes raised on your contracts and their resolutions.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : disputes.length === 0 ? (
        <EmptyState title="All good! No disputes here." subtitle="Disputes you or a counterparty raise will appear here." />
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => {
            const raisedByMe = d.raised_by === user?.id;
            return (
              <div key={d.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-100">{d.task_title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {d.reason} · raised by {raisedByMe ? 'you' : 'the other party'} ·{' '}
                      {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                </div>

                {d.description && <p className="mt-3 text-sm leading-relaxed text-neutral-300">{d.description}</p>}

                {d.status === 'resolved' && d.resolution ? (
                  <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200">
                    <span className="font-medium">Resolution:</span> {d.resolution}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-neutral-500">An admin will review this dispute within 24 hours.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
