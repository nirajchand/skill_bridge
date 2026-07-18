'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { Spinner } from '@/components/ui';
import { applicationsApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

const inputClass =
  'block w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition focus:border-emerald-500 focus:bg-neutral-50 focus:ring-4 focus:ring-emerald-100';

export default function ApplyModal({
  open,
  onClose,
  taskId,
  taskPrice,
  onApplied
}: {
  open: boolean;
  onClose: () => void;
  taskId: string;
  taskPrice: string;
  onApplied: () => void;
}) {
  const toast = useToast();
  const [coverLetter, setCoverLetter] = useState('');
  const [proposedPrice, setProposedPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await applicationsApi.apply({
        task_id: taskId,
        cover_letter: coverLetter.trim() || undefined,
        proposed_price: proposedPrice ? Number(proposedPrice) : null
      });
      toast.success('Applied successfully! Wait for the client’s response.');
      setCoverLetter('');
      setProposedPrice('');
      onApplied();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Submit your application" description="Tell the client why you’re a great fit.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Cover letter <span className="text-neutral-400">(optional)</span>
          </label>
          <textarea
            className={`${inputClass} min-h-[120px] resize-y`}
            maxLength={2000}
            placeholder="Share relevant experience and your approach…"
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Proposed price <span className="text-neutral-400">(optional — posting price is ${Number(taskPrice)})</span>
          </label>
          <input
            className={inputClass}
            type="number"
            min={5}
            max={100000}
            step="0.01"
            placeholder={`Leave blank to accept $${Number(taskPrice)}`}
            value={proposedPrice}
            onChange={(e) => setProposedPrice(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting && <Spinner className="h-4 w-4 border-white/30 border-t-white" />}
            Submit application
          </button>
        </div>
      </form>
    </Modal>
  );
}
