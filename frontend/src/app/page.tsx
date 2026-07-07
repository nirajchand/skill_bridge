'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const features = [
  {
    title: 'Instant Escrow',
    description: 'Funds lock the moment a contract starts — freelancers work with certainty, clients keep control.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2.25l7.5 3.375v5.25c0 5.006-3.21 9.36-7.5 10.875-4.29-1.515-7.5-5.869-7.5-10.875v-5.25L12 2.25z"
      />
    )
  },
  {
    title: 'Evidence-Based Disputes',
    description: 'When something goes wrong, both sides submit proof and a neutral reviewer resolves it fairly.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    )
  },
  {
    title: 'Transparent Fees',
    description: 'A flat, published fee on every transaction. No hidden cuts, no surprise deductions at payout.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182.553-.44 1.278-.659 2.003-.659.725 0 1.45.22 2.003.659l.797.6M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    )
  }
];

const steps = [
  { number: '01', title: 'Post or apply', description: 'Clients describe the task; freelancers apply with a clear scope and price.' },
  { number: '02', title: 'Fund the escrow', description: 'Payment is secured upfront and held safely until the work is approved.' },
  { number: '03', title: 'Deliver & release', description: 'Once the client approves, funds release to the freelancer instantly.' }
];

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [isLoading, router, user]);

  if (isLoading || user) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-neutral-100">
      {/* Ambient glows */}
      <div
        aria-hidden
        className="animate-float-glow pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-700/10 blur-[130px]"
      />

      {/* Hero */}
      <section className="relative mx-auto max-w-3xl px-6 pb-24 pt-40 text-center">
        <span className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-medium text-neutral-400 backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Escrow-secured freelance marketplace
        </span>

        <h1 className="animate-fade-in-up delay-100 font-display mt-8 text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-7xl">
          Freelance work,
          <br />
          paid{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            fairly
          </span>{' '}
          &amp; on time
        </h1>

        <p className="animate-fade-in-up delay-200 mx-auto mt-7 max-w-xl text-lg leading-relaxed text-neutral-400">
          SkillBridge holds every payment in escrow from day one and resolves disagreements with
          evidence — so clients and freelancers can focus on the work.
        </p>

        <div className="animate-fade-in-up delay-300 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/auth/register" className="btn-primary w-full px-7 py-3.5 sm:w-auto">
            Post a task
          </Link>
          <Link
            href="/auth/register"
            className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-7 py-3.5 text-sm font-semibold text-neutral-200 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06] sm:w-auto"
          >
            Find work
          </Link>
        </div>

        <p className="animate-fade-in delay-400 mt-6 text-xs text-neutral-600">
          No platform cut on task value &middot; Flat processing fee &middot; Cancel anytime before hire
        </p>
      </section>

      {/* Features */}
      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`animate-fade-in-up group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6 transition duration-300 hover:border-white/20 hover:from-white/[0.07] delay-${(i + 1) * 100}`}
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-inset ring-indigo-500/20 transition group-hover:bg-indigo-500/15">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                  {feature.icon}
                </svg>
              </div>
              <h3 className="font-display mt-5 text-base font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative border-t border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <h2 className="font-display text-center text-3xl font-semibold tracking-tight text-white">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-neutral-500">
            Three simple steps from first message to final payout.
          </p>

          <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="relative">
                <span className="font-display text-sm font-semibold text-indigo-400">{step.number}</span>
                <h3 className="font-display mt-3 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-4xl px-6 py-28 text-center">
        <div className="animate-gradient-x relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 bg-[length:200%_200%] px-8 py-16 shadow-glow">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" />
          <h2 className="font-display relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ready to work with confidence?
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-sm text-white/80">
            Create a free account and post your first task or start applying in minutes.
          </p>
          <Link
            href="/auth/register"
            className="relative mt-8 inline-block rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-indigo-700 shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-neutral-100"
          >
            Create your account
          </Link>
        </div>
      </section>

      <footer className="relative border-t border-white/5 px-6 py-8 text-center text-xs text-neutral-600">
        &copy; {new Date().getFullYear()} SkillBridge. All rights reserved.
      </footer>
    </div>
  );
}
