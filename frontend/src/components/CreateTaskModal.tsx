'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { Spinner } from '@/components/ui';
import { tasksApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import type { Task } from '@/lib/types';

const categories = ['writing', 'design', 'development', 'marketing', 'data', 'other'];

const inputClass =
  'block w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 outline-none transition focus:border-emerald-500 focus:bg-neutral-50 focus:ring-4 focus:ring-emerald-100';

export default function CreateTaskModal({
  open,
  onClose,
  onCreated
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (task: Task) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'development',
    price: '',
    deadline: '',
    skills_required: ''
  });
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () =>
    setForm({ title: '', description: '', category: 'development', price: '', deadline: '', skills_required: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) {
      toast.error('Please confirm you have the budget for this task');
      return;
    }
    setSubmitting(true);
    try {
      const task = await tasksApi.create({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        price: Number(form.price),
        deadline: form.deadline || null,
        skills_required: form.skills_required.trim() || null
      });
      toast.success('Task posted successfully!');
      reset();
      setAgree(false);
      onCreated(task);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Post a new task" description="Describe the work and set your budget.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Title <span className="text-neutral-400">({form.title.length}/200)</span>
          </label>
          <input
            className={inputClass}
            maxLength={200}
            required
            placeholder="e.g. Build a responsive landing page"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">
            Description <span className="text-neutral-400">({form.description.length}/5000)</span>
          </label>
          <textarea
            className={`${inputClass} min-h-[100px] resize-y`}
            maxLength={5000}
            required
            placeholder="Describe deliverables, requirements, and context…"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Category</label>
            <select
              className={`${inputClass} capitalize`}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {categories.map((c) => (
                <option key={c} value={c} className="bg-neutral-50 capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Price (USD)</label>
            <input
              className={inputClass}
              type="number"
              min={5}
              max={100000}
              step="0.01"
              required
              placeholder="500"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Deadline (optional)</label>
            <input
              className={inputClass}
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700">Skills (optional)</label>
            <input
              className={inputClass}
              placeholder="React, Figma"
              value={form.skills_required}
              onChange={(e) => setForm((f) => ({ ...f, skills_required: e.target.value }))}
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 bg-neutral-100 accent-emerald-500"
          />
          I have the budget for this task
        </label>

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
            Post task
          </button>
        </div>
      </form>
    </Modal>
  );
}
