import type { INestApplication } from '@nestjs/common';

/**
 * Express settings that change what a request MEANS, applied identically by
 * main.ts and by the test bootstrap.
 *
 * They live here rather than inline in main.ts because a setting only main.ts
 * applies is a setting no test can see - which is exactly how `trust proxy` went
 * missing: every rate-limit test passed against a server that, in production, put
 * every client on the platform into one bucket.
 */
export function applyHttpSettings(app: INestApplication, opts: { trustProxyHops: number }): void {
  const express = app.getHttpAdapter().getInstance() as {
    disable(name: string): void;
    set(name: string, value: unknown): void;
  };

  // Express announces itself on every response. It tells an attacker which stack to
  // look up known issues for and tells a legitimate client nothing at all.
  express.disable('x-powered-by');

  // So req.ip is the client rather than Render's load balancer - the rate limiter
  // keys on it. A hop count, never `true`: see TRUST_PROXY_HOPS in config/env.ts.
  express.set('trust proxy', opts.trustProxyHops);
}
