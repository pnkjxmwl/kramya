'use client';

import { useEffect, useState } from 'react';
import { AccountActionPurpose, type AccountActionPurpose as Purpose } from '@opd/contracts';

export function AccountActionForm({ initialPurpose = 'RESET_PASSWORD' }: { initialPurpose?: 'RESET_PASSWORD' | 'DELETE_ACCOUNT' }) {
  const [purpose, setPurpose] = useState<Purpose>(initialPurpose);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const parsed = AccountActionPurpose.safeParse(fragment.get('purpose'));
    if (parsed.success && fragment.get('token')) {
      setPurpose(parsed.data); setToken(fragment.get('token'));
      // Keep the one-time secret out of browser history after loading it into memory.
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError(''); setNotice('');
    try {
      const payload = token
        ? { purpose, token, ...(purpose === 'RESET_PASSWORD' ? { newPassword: password } : {}), ...(purpose === 'DELETE_ACCOUNT' && confirmed ? { confirmation: 'DELETE' } : {}) }
        : { purpose, email };
      const response = await fetch(`/api/auth/account-actions/${token ? 'confirm' : 'request'}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({ error: { message: 'Account service is temporarily unavailable. Try again or contact support.' } })) as { message?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? 'Could not complete the request. Try again or contact support.');
      setNotice(body.message ?? 'Request received.'); setPassword('');
      if (token) setDone(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Check your connection and try again.'); }
    finally { setPending(false); }
  }
  if (!token) return <p className="mt-6">Automatic account emails are currently unavailable. <a className="underline" href="mailto:pankajsemwal.careers@gmail.com">Contact support for recovery help</a> or <a className="underline" href="/delete-account">request deletion using your password</a>. Never send your password or OTP to support.</p>;
  return <form onSubmit={submit} className="mt-6 space-y-5" aria-label="Kramya account action">
    <h2 className="text-xl font-semibold">{purpose === 'VERIFY_EMAIL' ? 'Verify email' : purpose === 'DELETE_ACCOUNT' ? 'Request account deletion' : 'Reset password'}</h2>
    {!token && <label className="block">Account email<input className="mt-2 block w-full rounded-lg border border-slate-400 p-3" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></label>}
    {token && purpose === 'RESET_PASSWORD' && <label className="block">New password<input className="mt-2 block w-full rounded-lg border border-slate-400 p-3" type="password" autoComplete="new-password" minLength={10} maxLength={200} required value={password} onChange={e => setPassword(e.target.value)} /><span className="mt-1 block text-sm">Use at least 10 characters. Your existing sessions will be signed out.</span></label>}
    {token && purpose === 'DELETE_ACCOUNT' && <label className="flex items-start gap-3"><input className="mt-1 size-5" type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I request deletion of my Kramya account. Upcoming reservations will be cancelled where possible. Active consultations or clinic staff access may need a handover before deletion finishes. Limited records may be retained as described in the privacy notice.</span></label>}
    {notice && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-900">{notice}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-900">{error}</p>}
    <button className="min-h-12 rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60" disabled={pending || done}>{pending ? 'Please wait…' : token ? 'Confirm action' : 'Email me a confirmation link'}</button>
    <p className="text-sm text-slate-600">Opening an email link does not change your account. Confirm it here. If you reload this page before confirming, reopen the original email link. Need help? <a className="underline" href="mailto:pankajsemwal.careers@gmail.com">Contact Kramya support</a>.</p>
  </form>;
}
