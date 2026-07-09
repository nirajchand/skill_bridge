'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { contractsApi } from '@/lib/api';
import SubmitWorkModal from '@/components/SubmitWorkModal';
import RaiseDisputeModal from '@/components/RaiseDisputeModal';
import PaymentModal from '@/components/PaymentModal';
import { EmptyState, formatMoney, Spinner, StatusBadge } from '@/components/ui';
import type { Contract } from '@/lib/types';

const DISPUTABLE = ['funded', 'in_progress', 'submitted'];

function ContractCard({ contract, onChange }: { contract: Contract; onChange: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [detail, setDetail] = useState<Contract | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [revisionMode, setRevisionMode] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');

  const isClient = user?.id === contract.client_id;
  const isFreelancer = user?.id === contract.freelancer_id;
  const counterparty = isClient ? contract.freelancer_email : contract.client_email;

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    try {
      setDetail(await contractsApi.detail(contract.id));
    } catch {
      /* silent */
    } finally {
      setLoadingDetail(false);
    }
  }, [contract.id]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !detail) loadDetail();
  };

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      await loadDetail();
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const submissions = detail?.submissions ?? [];
  const latest = submissions[0];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <button onClick={toggle} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.02]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-100">{contract.task_title}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {isClient ? 'Freelancer' : 'Client'}: {counterparty}
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <StatusBadge status={contract.status} />
          <StatusBadge status={contract.escrow_status} />
        </div>
        <span className="font-display shrink-0 text-sm font-semibold text-white">{formatMoney(contract.agreed_price)}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={1.8}
          stroke="currentColor"
          className={`h-4 w-4 shrink-0 text-neutral-500 transition ${expanded ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-5 py-4">
          {/* mobile badges */}
          <div className="mb-4 flex items-center gap-2 sm:hidden">
            <StatusBadge status={contract.status} />
            <StatusBadge status={contract.escrow_status} />
          </div>

          {loadingDetail ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4">
              {detail?.revision_notes && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
                  <span className="font-medium">Revision requested:</span> {detail.revision_notes}
                </div>
              )}

              {latest && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-medium text-neutral-400">Latest submission</p>
                    <StatusBadge status={latest.status} />
                  </div>
                  <p className="text-sm text-neutral-200">{latest.description}</p>
                  {latest.files_url && (
                    <a href={latest.files_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-indigo-400 hover:text-indigo-300">
                      {latest.files_url}
                    </a>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {isClient && contract.status === 'pending' && (
                  <button onClick={() => setPayOpen(true)} className="btn-primary px-4 py-2">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                    Fund payment ({formatMoney(contract.agreed_price)})
                  </button>
                )}

                {isFreelancer && contract.status === 'in_progress' && contract.escrow_status === 'funded' && (
                  <button
                    onClick={() => setSubmitOpen(true)}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-neutral-200"
                  >
                    Submit work
                  </button>
                )}

                {isClient && contract.status === 'submitted' && (
                  <>
                    <button
                      onClick={() => run(() => contractsApi.approve(contract.id), 'Work approved — payment released!')}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                    >
                      {busy && <Spinner className="h-4 w-4 border-white/30 border-t-white" />}
                      Approve work
                    </button>
                    <button
                      onClick={() => setRevisionMode((v) => !v)}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5"
                    >
                      Request revision
                    </button>
                  </>
                )}

                {(isClient || isFreelancer) && DISPUTABLE.includes(contract.status) && (
                  <button
                    onClick={() => setDisputeOpen(true)}
                    className="rounded-lg border border-rose-500/30 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
                  >
                    Raise dispute
                  </button>
                )}

                {contract.status === 'completed' && (
                  <span className="text-sm text-emerald-400">✓ Completed — funds released to freelancer</span>
                )}
                {contract.status === 'disputed' && (
                  <span className="text-sm text-rose-300">A dispute is open on this contract.</span>
                )}
              </div>

              {revisionMode && (
                <div className="space-y-2">
                  <textarea
                    className="min-h-[80px] w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
                    placeholder="Describe the revisions you need (min 5 chars)…"
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                  />
                  <button
                    onClick={() =>
                      run(() => contractsApi.requestRevision(contract.id, revisionNotes.trim()), 'Revision requested').then(() => {
                        setRevisionMode(false);
                        setRevisionNotes('');
                      })
                    }
                    disabled={busy || revisionNotes.trim().length < 5}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-50"
                  >
                    Send revision request
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <SubmitWorkModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        contractId={contract.id}
        onSubmitted={async () => {
          await loadDetail();
          onChange();
        }}
      />
      <RaiseDisputeModal open={disputeOpen} onClose={() => setDisputeOpen(false)} contractId={contract.id} onRaised={onChange} />
      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        contractId={contract.id}
        amount={contract.agreed_price}
        onFunded={onChange}
      />
    </div>
  );
}

export default function ContractsPage() {
  const toast = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setContracts(await contractsApi.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white">Contracts</h2>
        <p className="mt-1 text-sm text-neutral-500">Fund escrow, submit and approve work, and manage disputes.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : contracts.length === 0 ? (
        <EmptyState title="No contracts yet" subtitle="Contracts appear here once a client hires a freelancer." />
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <ContractCard key={c.id} contract={c} onChange={load} />
          ))}
        </div>
      )}
    </div>
  );
}
