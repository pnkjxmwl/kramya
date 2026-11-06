import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const TTL = 30_000;
const key = (refresh: string) => createHash('sha256').update('kramya-queue-notice-v1\0').update(refresh).digest();
const aad = Buffer.from('kramya-queue-notice-v1');

/** Private, session-bound feedback; never an authorization or queue-state source. */
export function sealQueueNotice(refresh: string, sessionId: string, message: string, now = Date.now()): string {
  if (!refresh || message.length > 600) throw new Error('Invalid queue notice');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(refresh), iv);
  cipher.setAAD(aad);
  const body = Buffer.concat([cipher.update(JSON.stringify({ sessionId, message, expires: now + TTL })), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

export function openQueueNotice(value: string | undefined, refresh: string | undefined, sessionId: string, now = Date.now()): string | undefined {
  if (!refresh || !value || value.length > 3000) return undefined;
  try {
    const parts = value.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1' || parts.slice(1).some(p => !/^[\w-]+$/.test(p))) return undefined;
    const iv = Buffer.from(parts[1]!, 'base64url'), tag = Buffer.from(parts[2]!, 'base64url');
    if (iv.length !== 12 || tag.length !== 16) return undefined;
    const decipher = createDecipheriv('aes-256-gcm', key(refresh), iv); decipher.setAAD(aad); decipher.setAuthTag(tag);
    const data = JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[3]!, 'base64url')), decipher.final()]).toString('utf8')) as { sessionId?: unknown; message?: unknown; expires?: unknown };
    if (data.sessionId !== sessionId || typeof data.message !== 'string' || data.message.length > 600 || typeof data.expires !== 'number' || data.expires <= now || data.expires > now + TTL) return undefined;
    return data.message;
  } catch { return undefined; }
}
