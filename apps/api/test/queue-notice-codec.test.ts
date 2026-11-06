import { describe, expect, it } from 'vitest';
import { openQueueNotice, sealQueueNotice } from '../../web/lib/queue-notice-codec';

describe('private reception feedback', () => {
  it('encrypts feedback and binds it to the login and clinic session', () => {
    const value = sealQueueNotice('local-test-refresh-a', 'session-a', 'TEST Sensitive Patient checked in', 1000);
    expect(value).not.toContain('Sensitive Patient');
    expect(openQueueNotice(value, 'local-test-refresh-a', 'session-a', 1001)).toBe('TEST Sensitive Patient checked in');
    expect(openQueueNotice(value, 'local-test-refresh-b', 'session-a', 1001)).toBeUndefined();
    expect(openQueueNotice(value, 'local-test-refresh-a', 'session-b', 1001)).toBeUndefined();
  });
  it('refuses expired, tampered, malformed and oversized notices', () => {
    const value = sealQueueNotice('local-test-refresh-a', 'session-a', 'TEST Patient', 1000);
    expect(openQueueNotice(value, 'local-test-refresh-a', 'session-a', 31000)).toBeUndefined();
    const parts = value.split('.'); parts[3] = (parts[3]![0] === 'a' ? 'b' : 'a') + parts[3]!.slice(1);
    expect(openQueueNotice(parts.join('.'), 'local-test-refresh-a', 'session-a', 1001)).toBeUndefined();
    expect(openQueueNotice('v1.invalid', 'local-test-refresh-a', 'session-a', 1001)).toBeUndefined();
    expect(openQueueNotice('x'.repeat(3001), 'local-test-refresh-a', 'session-a', 1001)).toBeUndefined();
    expect(openQueueNotice(value, undefined, 'session-a', 1001)).toBeUndefined();
  });
});
