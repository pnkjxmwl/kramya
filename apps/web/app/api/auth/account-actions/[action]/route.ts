import { NextRequest, NextResponse } from 'next/server';
import { RequestAccountAction, ConfirmAccountAction } from '@opd/contracts';
import { apiFetch } from '../../../../../lib/session';

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== 'request' && action !== 'confirm') return NextResponse.json({ error: { message: 'Unknown action' } }, { status: 404 });
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: { message: 'Origin refused' } }, { status: 403 });
  const parsed = (action === 'request' ? RequestAccountAction : ConfirmAccountAction).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { message: 'Check the email, confirmation and password fields.' } }, { status: 400 });
  try {
    const upstream = await apiFetch(`/auth/account-actions/${action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data), cache: 'no-store', signal: AbortSignal.timeout(20_000),
    });
    return NextResponse.json(await upstream.json(), { status: upstream.status, headers: { 'cache-control': 'no-store' } });
  } catch { return NextResponse.json({ error: { message: 'Account service is unavailable. Try again or contact support.' } }, { status: 503 }); }
}
