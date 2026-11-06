import { NextResponse } from 'next/server';
import { AuthTokens, ExternalAccountDeletionRequest } from '@opd/contracts';
import { apiFetch } from '../../../../lib/session';

export async function POST(req: Request): Promise<NextResponse> {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: { message: 'Use the Kramya account deletion page.' } }, { status: 403 });
  const parsed = ExternalAccountDeletionRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { message: 'Enter your account email, password and explicit deletion confirmation.' } }, { status: 400 });
  try {
    const login = await apiFetch('/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }), cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!login.ok) return NextResponse.json({ error: { message: login.status === 401 ? 'Email or password is incorrect. Contact support if you cannot sign in.' : 'Sign-in is unavailable. Try later or contact support.' } }, { status: login.status });
    const tokens = AuthTokens.parse(await login.json());
    // Tokens remain server-side. Deletion uses the same password proof/fulfilment as Android.
    try {
      const result = await apiFetch('/me/account-deletion', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.accessToken}` },
        body: JSON.stringify({ password: parsed.data.password, confirmation: 'DELETE' }), cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      return NextResponse.json(await result.json(), { status: result.status, headers: { 'cache-control': 'no-store' } });
    } finally {
      // Pending/failed deletion must not leave this temporary login session active.
      await apiFetch('/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }), cache: 'no-store', signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
    }
  } catch { return NextResponse.json({ error: { message: 'Account service is unavailable. Try again or contact Kramya support.' } }, { status: 503 }); }
}
