'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { Spinner } from '@/components/ui';
import { disputesApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

const reasons = [
  'Work not as agreed',
  'Freelancer unresponsive',
  'Client unresponsive',
  'Quality issue',
  'Scope mismatch',
  'Payment not released',
  'Other'
];

const inputClass =
  'block w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition focus:border-indigo-500/60 focus:bg-white/[0.05] focus:ring-4 focus:ring-indigo-500/10';

export default function RaiseDisputeModal({
  open,
  onClose,
  contractId,
  onRaised
}: {
  open: boolean;
  onClose: () => void;
  contractId: string;
  onRaised: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState(reasons[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 20) {
      toast.error('Description must be at least 20 characters');
      return;
    }
    setSubmitting(true);
    try {
      await disputesApi.raise({ contract_id: contractId, reason, description: description.trim() });
      toast.success('Dispute raised. An admin will review within 24 hours.');
      setDescription('');
      onRaised();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to raise dispute');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Raise a dispute" description="Explain the issue and provide detail.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-300">Reason</label>
          <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>
            {reasons.map((r) => (
              <option key={r} value={r} className="bg-neutral-900">
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-300">
            Description <span className="text-neutral-600">({description.length} chars, min 20)</span>
          </label>
          <textarea
            className={`${inputClass} min-h-[110px] resize-y`}
            required
            placeholder="Describe what went wrong, with any evidence links…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-white/5">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
          >
            {submitting && <Spinner className="h-4 w-4 border-white/30 border-t-white" />}
            Submit dispute
          </button>
        </div>
      </form>
    </Modal>
  );
}
