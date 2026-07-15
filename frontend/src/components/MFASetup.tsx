'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import { mfaApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { Spinner } from '@/components/ui';

export default function MFASetup() {
  const toast = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const loadStatus = async () => {
    try {
      const s = await mfaApi.status();
      setEnabled(s.enabled);
    } catch {
      setEnabled(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const startSetup = async () => {
    setBusy(true);
    try {
      const { qr: qrUrl, secret: sec } = await mfaApi.setup();
      setQr(qrUrl);
      setSecret(sec);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start setup');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    setBusy(true);
    try {
      const { backupCodes: codes } = await mfaApi.enable(code.trim());
      setBackupCodes(codes);
      setQr(null);
      setCode('');
      setEnabled(true);
      toast.success('Two-factor authentication enabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    const token = window.prompt('Enter a current 6-digit code to disable 2FA:');
    if (!token) return;
    setBusy(true);
    try {
      await mfaApi.disable(token.trim());
      setEnabled(false);
      setBackupCodes(null);
      toast.info('Two-factor authentication disabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable');
    } finally {
      setBusy(false);
    }
  };

  if (enabled === null) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold text-white">Two-factor authentication</h3>
          <p className="mt-0.5 text-xs text-neutral-500">Add a second step at sign-in using an authenticator app.</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
            enabled ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20' : 'bg-neutral-500/10 text-neutral-400 ring-neutral-500/20'
          }`}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {/* Backup codes shown once after enabling */}
      {backupCodes && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-200">Save your backup codes</p>
          <p className="mt-1 text-xs text-amber-200/70">Each can be used once if you lose your authenticator. They won&apos;t be shown again.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-neutral-200 sm:grid-cols-5">
            {backupCodes.map((c) => (
              <span key={c} className="rounded-md bg-black/40 px-2 py-1 text-center">{c}</span>
            ))}
          </div>
        </div>
      )}

      {!enabled && !qr && (
        <button onClick={startSetup} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-60">
          {busy && <Spinner className="h-4 w-4 border-black/30 border-t-black" />}
          Enable 2FA
        </button>
      )}

      {qr && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <img src={qr} alt="Scan this QR code" className="h-40 w-40 rounded-lg bg-white p-2" />
            <div className="text-sm text-neutral-400">
              <p>1. Scan the QR code with Google Authenticator, Authy, 1Password, etc.</p>
              <p className="mt-2">Or enter this key manually:</p>
              <code className="mt-1 block break-all rounded-md bg-black/40 px-2 py-1 font-mono text-xs text-neutral-300">{secret}</code>
              <p className="mt-2">2. Enter the 6-digit code it generates:</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              className="w-40 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-center tracking-widest text-neutral-100 placeholder-neutral-600 outline-none focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button onClick={confirmEnable} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-60">
              {busy && <Spinner className="h-4 w-4 border-black/30 border-t-black" />}
              Verify & enable
            </button>
          </div>
        </div>
      )}

      {enabled && !backupCodes && (
        <button onClick={disable} disabled={busy} className="rounded-xl border border-rose-500/30 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-60">
          Disable 2FA
        </button>
      )}
    </div>
  );
}
