'use client';

import type { ChecklistItem } from '@/lib/types';

export default function ProfileCompletionBar({
  percentage,
  checklist
}: {
  percentage: number;
  checklist?: ChecklistItem[];
}) {
  const complete = percentage >= 100;
  const barColor = complete ? 'bg-emerald-500' : percentage >= 60 ? 'bg-indigo-500' : 'bg-amber-500';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-200">Profile completion</p>
        <span className={`font-display text-sm font-semibold ${complete ? 'text-emerald-400' : 'text-neutral-200'}`}>
          {percentage}%
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percentage}%` }} />
      </div>

      {!complete && checklist && (
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-xs">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full ${
                  item.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-neutral-600'
                }`}
              >
                {item.done ? (
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={3} stroke="currentColor" className="h-2.5 w-2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : null}
              </span>
              <span className={item.done ? 'text-neutral-500 line-through' : 'text-neutral-300'}>{item.label}</span>
            </li>
          ))}
        </ul>
      )}

      {complete && <p className="mt-3 text-xs text-emerald-400">🎉 Your profile is complete!</p>}
    </div>
  );
}
