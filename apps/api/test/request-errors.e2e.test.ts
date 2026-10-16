import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, request } from './helpers';

/**
 * Requests that fail before any controller runs - in Express's body parser - still
 * answer in the one error envelope, with a CLIENT status.
 *
 * An oversized body used to answer 500 INTERNAL_ERROR: the caller was told the
 * server broke, the log said so at error level, and Sentry was paged, for a request
 * the client got wrong. A malformed body echoed the JSON parser's own message,
 * byte offset included, which is internals (docs/Rules.md 7).
 */
describe('body-parser failures', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 413 in the envelope for an oversized body, not 500', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ email: 'a'.repeat(200_000), password: 'x' }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.message).toBe('Request body is too large');
  });

  it('answers 400 for malformed JSON without echoing the parser', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('content-type', 'application/json')
      .send('{bad');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.message).toBe('Request body is not valid JSON');
  });
});
