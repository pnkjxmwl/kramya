import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvSchema } from '../../config/env';
import { FcmClient } from './fcm.client';

const firebase = vi.hoisted(() => ({
  send: vi.fn(),
  initialize: vi.fn(() => ({ name: 'test' })),
}));
vi.mock('firebase-admin/app', () => ({
  getApps: () => [],
  getApp: vi.fn(),
  cert: vi.fn(),
  initializeApp: firebase.initialize,
}));
vi.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ send: firebase.send }),
}));

const config = (credential = '') =>
  EnvSchema.parse({
    DATABASE_URL: 'postgresql://localhost/test',
    REDIS_URL: 'redis://localhost',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    CHECKIN_SECRET: 'c'.repeat(32),
    FIREBASE_SERVICE_ACCOUNT: credential,
  });
const validCredential = Buffer.from(
  JSON.stringify({
    project_id: 'test',
    client_email: 'test@example.test',
    private_key: 'mocked-test-key',
  }),
).toString('base64');
const message = {
  token: 'fcm-test-device-token',
  title: 'Your turn',
  body: 'Check your visit',
  data: { entryId: 'test-entry' },
};

describe('Kotlin FCM delivery', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['', 'not-json'])(
    'keeps devices when Firebase credentials are unavailable (%s)',
    async (credential) => {
      const client = new FcmClient(config(credential));
      expect(client.configured).toBe(false);
      expect(await client.send([message])).toMatchObject([{ ok: false, deviceGone: false }]);
      expect(firebase.send).not.toHaveBeenCalled();
    },
  );

  it('submits a tray notification with the visit link and Android channel', async () => {
    firebase.send.mockResolvedValue('provider-message-id');
    const client = new FcmClient(config(validCredential));
    expect(client.configured).toBe(true);
    expect(await client.send([message])).toEqual([
      { token: message.token, ok: true, deviceGone: false },
    ]);
    expect(firebase.send).toHaveBeenCalledWith(
      expect.objectContaining({
        token: message.token,
        data: message.data,
        notification: { title: message.title, body: message.body },
        android: expect.objectContaining({
          priority: 'high',
          notification: { channelId: 'queue', sound: 'default' },
        }),
      }),
    );
  });

  it.each([
    ['messaging/registration-token-not-registered', true],
    ['messaging/invalid-registration-token', true],
    ['messaging/invalid-argument', false],
    ['messaging/quota-exceeded', false],
    ['messaging/server-unavailable', false],
  ])('only prunes confirmed bad tokens: %s', async (code, deviceGone) => {
    firebase.send.mockRejectedValue(Object.assign(new Error(code), { code }));
    expect(await new FcmClient(config(validCredential)).send([message])).toMatchObject([
      { ok: false, deviceGone },
    ]);
  });
});
