'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import Modal from '@/components/Modal';
import { Spinner, formatMoney } from '@/components/ui';
import { paymentsApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const cardStyle = {
  style: {
    base: {
      color: '#f5f5f5',
      fontFamily: 'inherit',
      fontSize: '15px',
      '::placeholder': { color: '#6b7280' }
    },
    invalid: { color: '#fb7185' }
  }
};

function CheckoutForm({
  contractId,
  amount,
  onFunded,
  onClose
}: {
  contractId: string;
  amount: string;
  onFunded: () => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;

    setProcessing(true);
    try {
      // 1. Ask the backend to create a PaymentIntent for this contract.
      const { clientSecret, paymentIntentId } = await paymentsApi.createIntent(contractId);

      // 2. Confirm the card payment client-side with Stripe.
      const result = await stripe.confirmCardPayment(clientSecret, { payment_method: { card } });
      if (result.error) {
        toast.error(result.error.message || 'Payment failed');
        setProcessing(false);
        return;
      }

      // 3. Tell the backend to verify & release escrow into "funded".
      await paymentsApi.confirm(contractId, paymentIntentId);
      toast.success('Payment successful — funds held in escrow!');
      onFunded();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">Amount to fund</span>
          <span className="font-display text-lg font-semibold text-white">{formatMoney(amount)}</span>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-neutral-300">Card details</label>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 transition focus-within:border-indigo-500/60 focus-within:ring-4 focus-within:ring-indigo-500/10">
          <CardElement options={cardStyle} />
        </div>
        <p className="mt-2 text-xs text-neutral-600">
          Test card: <span className="text-neutral-400">4242 4242 4242 4242</span> · any future date · any CVC/ZIP
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-white/5"
        >
          Cancel
        </button>
        <button type="submit" disabled={!stripe || processing} className="btn-primary">
          {processing && <Spinner className="h-4 w-4 border-white/30 border-t-white" />}
          Pay {formatMoney(amount)}
        </button>
      </div>
    </form>
  );
}

export default function PaymentModal({
  open,
  onClose,
  contractId,
  amount,
  onFunded
}: {
  open: boolean;
  onClose: () => void;
  contractId: string;
  amount: string;
  onFunded: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Fund escrow" description="Your payment is held securely until you approve the work.">
      {!stripePromise ? (
        <p className="text-sm text-rose-300">
          Stripe is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to <code>frontend/.env.local</code>.
        </p>
      ) : (
        <Elements stripe={stripePromise}>
          <CheckoutForm contractId={contractId} amount={amount} onFunded={onFunded} onClose={onClose} />
        </Elements>
      )}
    </Modal>
  );
}
