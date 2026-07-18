'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { Spinner } from '@/components/ui';
import { contractsApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

const inputClass =
  'block w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition focus:border-emerald-500 focus:bg-neutral-50 focus:ring-4 focus:ring-emerald-100';

export default function SubmitWorkModal({
  open,
  onClose,
  contractId,
  onSubmitted
}: {
  open: boolean;
  onClose: () => void;
  contractId: string;
  onSubmitted: () => void;
}) {
  const toast = useToast();
  const [description, setDescription] = useState('');
  const [filesUrl, setFilesUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await contractsApi.submitWork(contractId, {
        description: description.trim(),
        files_url: filesUrl.trim() || undefined
      });
      toast.success('Work submitted! Waiting for client approval.');
      setDescription('');
      setFilesUrl('');
      onSubmitted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit work');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Submit your work" description="Describe what you completed and share links.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">What have you completed?</label>
          <textarea
            className={`${inputClass} min-h-[110px] resize-y`}
            required
            placeholder="Summary of deliverables…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Links <span className="text-neutral-400">(optional — GitHub, Figma, Drive…)</span>
          </label>
          <input
            className={inputClass}
            placeholder="https://github.com/…"
            value={filesUrl}
            onChange={(e) => setFilesUrl(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-700 transition hover:bg-neutral-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting && <Spinner className="h-4 w-4 border-white/30 border-t-white" />}
            Submit work
          </button>
        </div>
      </form>
    </Modal>
  );
}
