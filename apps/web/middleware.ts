import { NextResponse, type NextRequest } from 'next/server';
import type { AuthTokens } from '@opd/contracts';
import { ACCESS_COOKIE, REFRESH_COOKIE, ROTATION_COOKIE, apiUrl, writeSession } from './lib/session';

/**
 * Route protection + silent token refresh.
 *
 * Refresh lives here because middleware is the only place that can write cookies
 * during an ordinary navigation - a server component can read them but not set
 * them. Without this, every session would hard-expire after JWT_ACCESS_TTL_SEC
 * (15 minutes) and bounce the user to /login mid-task.
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;

  if (access && !isExpiringSoon(access)) return NextResponse.next();

  // No refresh token, or refresh fails: this is a logged-out visitor.
  if (!refresh) return toLogin(req);

  const upstream = await fetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh, rotationKey: req.cookies.get(ROTATION_COOKIE)?.value }),
    cache: 'no-store',
  }).catch(() => null);

  if (!upstream || upstream.status >= 500 || upstream.status === 429) {
    return new NextResponse('The clinic server is temporarily unavailable. Please retry shortly.', { status: 503, headers: { 'Retry-After': '10', 'Cache-Control': 'no-store' } });
  }

  if (!upstream.ok) {
    const res = toLogin(req);
    // The API already revoked the family (or never knew the token); drop our copies
    // so the next request does not retry a dead token on every navigation.
    res.cookies.delete(ACCESS_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
    res.cookies.delete(ROTATION_COOKIE);
    return res;
  }

  const tokens = (await upstream.json()) as AuthTokens;
  // Downstream server components must see the renewed token on this same request.
  req.cookies.set(ACCESS_COOKIE, tokens.accessToken);
  req.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
  if (tokens.rotationKey) req.cookies.set(ROTATION_COOKIE, tokens.rotationKey);
  const res = NextResponse.next({ request: { headers: req.headers } });
  writeSession(res.cookies, tokens);
  return res;
}

function toLogin(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  // Remember where they were headed so login can send them back.
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

/**
 * Reads `exp` without verifying the signature - verification is the API's job, and
 * middleware only needs to know whether it is worth refreshing. A forged token gets
 * rejected by the API on the very next call.
 */
function isExpiringSoon(token: string, skewSeconds = 60): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return true;
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: number };
    if (!exp) return true;
    return exp * 1000 - Date.now() < skewSeconds * 1000;
  } catch {
    return true;
  }
}

export const config = {
  /*
    Everything under (console) is protected. /login, /accept-invite, /api/auth/* and
    static assets must stay reachable or the redirect would loop.

    /accept-invite is public by necessity: an invitee has no session yet, and the
    token in the URL is the only thing that identifies them.

    **The bare `/` is now public too, and it is listed separately because a negative
    lookahead cannot express it.** The path after the leading slash is the empty
    string there, which matches `(?!login|...).*` no matter what is in the group - so
    the marketing page would have been bounced to /login by the same rule that
    protects the board. The console's own landing screen moved to /overview.

    **`demo` is public by design and must stay that way.** The whole point of it is
    that a hospital can see the console working without an account, so anything that
    sends it to /login defeats it. It is safe to expose because it touches nothing:
    every number on those screens is a hardcoded fixture in the page, there is no
    API call, no session and no tenant - see app/demo/fixtures.ts.
  */
  /*
    `icon.png` and `apple-icon.png` are listed because they are ROUTES.

    Next generates them from `app/icon.png` and `app/apple-icon.png` and serves them
    at the top level - not from `_next/static` - so the exclusion for `favicon.ico`
    did not cover them and the browser's request for the tab icon was answered with a
    307 to /login. Caught by fetching it against the deployed site rather than by
    looking at the page, because a missing favicon is silent: the tab just keeps the
    browser's default and nothing errors.
  */
  matcher: [
    '/((?!login|accept-invite|demo|api/auth|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|$).*)',
  ],
};
