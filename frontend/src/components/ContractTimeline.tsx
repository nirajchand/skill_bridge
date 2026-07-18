'use client';

import type { Contract } from '@/lib/types';
import { STAGES, completedStages, isCancelled, isDisputed } from '@/lib/contractFlow';

/**
 * Horizontal stepper showing where a contract sits in the escrow lifecycle.
 *
 * The whole confusion this solves is "why can't I submit work yet?" — seeing
 * "Payment secured" greyed out answers that instantly, without the user needing
 * to know the state machine.
 */
export default function ContractTimeline({ contract }: { contract: Contract }) {
  const done = completedStages(contract);
  const disputed = isDisputed(contract);
  const cancelled = isCancelled(contract);

  return (
    <div>
      <ol className="flex items-start">
        {STAGES.map((stage, i) => {
          const isDone = i < done;
          const isCurrent = i === done - 1;
          // A dispute/cancellation freezes progress — don't imply it's still moving.
          const halted = disputed || cancelled;

          const dot = halted && isCurrent
            ? 'border-rose-500 bg-rose-500 text-white'
            : isDone
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-neutral-300 bg-white text-neutral-400';

          return (
            <li key={stage.key} className="relative flex flex-1 flex-col items-center text-center">
              {/* Connector to the previous step (skipped on the first). */}
              {i > 0 && (
                <span
                  aria-hidden
                  className={`absolute right-1/2 top-3 h-0.5 w-full ${i < done ? 'bg-brand-600' : 'bg-neutral-200'}`}
                />
              )}

              <span
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold ${dot}`}
              >
                {isDone ? (
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={3.5} stroke="currentColor" className="h-3 w-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>

              <p className={`mt-1.5 text-[11px] font-medium ${isDone ? 'text-neutral-900' : 'text-neutral-400'}`}>
                {stage.label}
              </p>
              <p className="text-[10px] leading-tight text-neutral-400">{stage.blurb}</p>
            </li>
          );
        })}
      </ol>

      {disputed && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-center text-xs font-medium text-rose-700">
          Progress paused — this contract is in dispute.
        </p>
      )}
    </div>
  );
}
