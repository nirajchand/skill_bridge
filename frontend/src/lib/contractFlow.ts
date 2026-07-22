import type { Contract } from '@/lib/types';

/**
 * The escrow lifecycle, in one place.
 *
 * The backend enforces this state machine (routes/contracts.js + routes/payments.js);
 * this module simply EXPLAINS it to each side. It exists because the same contract
 * state means opposite things depending on who is looking:
 *
 *   status=pending    -> client: "pay to start"      | freelancer: "waiting for payment"
 *   status=in_progress-> client: "waiting for work"  | freelancer: "deliver the work"
 *   status=submitted  -> client: "review it"         | freelancer: "waiting for review"
 *
 * Keeping the copy here (rather than scattered through JSX) means the UI can never
 * drift from the rules the server actually enforces.
 */

export type StageKey = 'hired' | 'funded' | 'submitted' | 'completed';

export const STAGES: { key: StageKey; label: string; blurb: string }[] = [
  { key: 'hired', label: 'Hired', blurb: 'Contract created' },
  { key: 'funded', label: 'Payment secured', blurb: 'Client funds escrow' },
  { key: 'submitted', label: 'Work delivered', blurb: 'Freelancer submits' },
  { key: 'completed', label: 'Paid out', blurb: 'Client approves, funds release' }
];

/** How many stages are complete (0-4). Drives the progress indicator. */
export function completedStages(c: Contract): number {
  if (c.status === 'completed') return 4;
  if (c.status === 'submitted') return 3;
  if (c.escrow_status === 'funded' || c.status === 'in_progress') return 2;
  return 1; // hired
}

export function isDisputed(c: Contract) {
  return c.status === 'disputed';
}
export function isCancelled(c: Contract) {
  return c.status === 'cancelled' || c.escrow_status === 'refunded';
}

export type NextStep = {
  /** Whose move is it — drives "your turn" highlighting. */
  yourTurn: boolean;
  title: string;
  detail: string;
  tone: 'action' | 'waiting' | 'done' | 'alert';
};

/**
 * What happens next, written for the person reading it.
 * `isClient` decides voice — never show a freelancer a "pay now" instruction.
 */
export function nextStep(c: Contract, isClient: boolean): NextStep {
  if (isDisputed(c)) {
    return {
      yourTurn: false,
      tone: 'alert',
      title: 'Dispute under review',
      detail: 'An admin is reviewing the evidence. Funds stay held in escrow until it is resolved.'
    };
  }

  if (isCancelled(c)) {
    return {
      yourTurn: false,
      tone: 'done',
      title: 'Cancelled — refunded',
      detail: isClient
        ? 'The escrow was refunded to your card.'
        : 'This contract was cancelled and the client was refunded.'
    };
  }

  if (c.status === 'completed') {
    return {
      yourTurn: false,
      tone: 'done',
      title: 'Completed',
      detail: isClient
        ? 'You approved the work and the payment was released to the freelancer.'
        : 'The client approved your work and the payment was released to you.'
    };
  }

  // Step 1 — escrow must be funded before ANY work can be submitted. The server
  // rejects submissions until then, so this is the true blocker.
  if (c.status === 'pending' || c.escrow_status === 'not_funded') {
    return isClient
      ? {
          yourTurn: true,
          tone: 'action',
          title: 'Fund the escrow to start',
          detail:
            'Your payment is held securely by SkillBridge — the freelancer cannot be paid until you approve the work, and they cannot start until it is funded.'
        }
      : {
          yourTurn: false,
          tone: 'waiting',
          title: 'Waiting for the client to fund payment',
          detail:
            'You can start submitting work once the client secures the payment in escrow. This protects you: the money is guaranteed before you deliver.'
        };
  }

  // Step 2 — money is safe, freelancer delivers.
  if (c.status === 'in_progress') {
    const revisionAsked = !!c.revision_notes;
    return isClient
      ? {
          yourTurn: false,
          tone: 'waiting',
          title: revisionAsked ? 'Waiting for the revised work' : 'Waiting for the freelancer to deliver',
          detail: 'Your payment is held in escrow. It is only released when you approve what they send.'
        }
      : {
          yourTurn: true,
          tone: 'action',
          title: revisionAsked ? 'Submit your revised work' : 'Payment secured — submit your work',
          detail: revisionAsked
            ? 'The client asked for changes. Send an updated submission when ready.'
            : 'The money is already held in escrow, so you are safe to do the work and submit it here.'
        };
  }

  // Step 3 — client reviews.
  if (c.status === 'submitted') {
    return isClient
      ? {
          yourTurn: true,
          tone: 'action',
          title: 'Review the delivered work',
          detail: 'Approve to release the payment, or request changes if it is not right yet.'
        }
      : {
          yourTurn: false,
          tone: 'waiting',
          title: 'Waiting for the client to review',
          detail: 'They will either approve (releasing your payment) or ask for changes.'
        };
  }

  return { yourTurn: false, tone: 'waiting', title: 'In progress', detail: '' };
}
