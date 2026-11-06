'use client';
import { useState } from 'react';

export function PasswordDeletionForm() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false), [pending, setPending] = useState(false);
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [done, setDone] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/auth/account-deletion', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, ...(confirmed ? { confirmation: 'DELETE' } : {}) }) });
      const body = await response.json() as { message?: string; deleted?: boolean; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? 'Could not request deletion. Contact support.');
      setMessage(body.message ?? 'Deletion request received.'); setDone(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Check your connection and try again.'); }
    finally { setPassword(''); setPending(false); }
  }
  return <form onSubmit={submit} className="mt-6 space-y-4" aria-label="Delete a password-based Kramya account">
    <h2 className="text-xl font-semibold">Confirm account ownership</h2>
    <label className="block">Account email<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="mt-2 block min-h-12 w-full rounded-lg border border-slate-400 p-3" /></label>
    <label className="block">Current password<input type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={e => setPassword(e.target.value)} className="mt-2 block min-h-12 w-full rounded-lg border border-slate-400 p-3" /></label>
    <label className="flex items-start gap-3"><input className="mt-1 size-5" type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I request account deletion. Eligible upcoming reservations will be cancelled and limited historical records may be retained as explained above.</span></label>
    {message && <p role="status" className="rounded-lg bg-green-50 p-4">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4">{error}</p>}
    <button disabled={pending || done} className="min-h-12 rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60">{pending ? 'Submitting request…' : 'Request account deletion'}</button>
    <p className="text-sm">No confirmation email is needed for this password-based request. If you cannot sign in or use only Google sign-in, contact support to arrange ownership verification.</p>
  </form>;
}
