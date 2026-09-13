import { describe, expect, it } from 'vitest';
import type { ExpoClient, ExpoApi, PushMessage, PushResult } from './expo.client';
import type { FcmClient } from './fcm.client';
import { PushRouter } from './push.router';

/**
 * Two patient apps now hold two kinds of push token, and the only thing standing between
 * them is this router. Getting the partition wrong does not throw - it silently sends a
 * native device's token to Expo, which rejects the format, reports `deviceGone`, and lets
 * the existing pruning disable a perfectly live device. The patient then receives nothing,
 * for ever, and the only evidence is a `disabledAt` column.
 */

/** Records what it was given and answers however the test needs. */
class FakeProvider implements ExpoApi {
  readonly sent: PushMessage[] = [];
  configured = true;
  mode: 'ok' | 'device-gone' | 'throw' = 'ok';

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    if (this.mode === 'throw') throw new Error('provider exploded');
    this.sent.push(...messages);
    return messages.map((message) => ({
      token: message.token,
      ok: this.mode === 'ok',
      deviceGone: this.mode === 'device-gone',
    }));
  }
}

const message = (token: string): PushMessage => ({
  token,
  title: 'Your turn',
  body: 'Please go in now.',
  data: { entryId: 'e1', sessionId: 's1', type: 'CALLED' },
});

const EXPO_TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
/** What FirebaseMessaging hands apps/native - long, opaque, and not Expo-shaped. */
const FCM_TOKEN =
  'fZ9kQ2xLTd6mR1sVbN8cYw:APA91bH' + 'x'.repeat(120);

function router(expo: FakeProvider, fcm: FakeProvider) {
  return new PushRouter(expo as unknown as ExpoClient, fcm as unknown as FcmClient);
}

describe('PushRouter', () => {
  it('sends an Expo token to Expo and an FCM token to FCM', async () => {
    const expo = new FakeProvider();
    const fcm = new FakeProvider();

    await router(expo, fcm).send([message(EXPO_TOKEN), message(FCM_TOKEN)]);

    expect(expo.sent.map((m) => m.token)).toEqual([EXPO_TOKEN]);
    expect(fcm.sent.map((m) => m.token)).toEqual([FCM_TOKEN]);
  });

  it('returns one result per token, whichever provider handled it', async () => {
    const expo = new FakeProvider();
    const fcm = new FakeProvider();

    const results = await router(expo, fcm).send([
      message(EXPO_TOKEN),
      message(FCM_TOKEN),
      message('ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]'),
    ]);

    // NotificationsService decides "delivered" by looking for ONE ok result, and prunes by
    // matching results to tokens. A result count that does not match the send count makes
    // both of those quietly wrong.
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('does not call a provider that has nothing to send', async () => {
    const expo = new FakeProvider();
    const fcm = new FakeProvider();

    await router(expo, fcm).send([message(EXPO_TOKEN)]);

    expect(fcm.sent).toHaveLength(0);
  });

  it('one provider throwing does not lose the other provider results', async () => {
    // A patient holds tokens for BOTH apps right now - the native build is installed
    // beside the Expo one for comparison - so an outage at one must not take the other
    // down with it. Reaching one device is a delivered notification.
    const expo = new FakeProvider();
    const fcm = new FakeProvider();
    fcm.mode = 'throw';

    const results = await router(expo, fcm).send([message(EXPO_TOKEN), message(FCM_TOKEN)]);

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.token === EXPO_TOKEN)?.ok).toBe(true);
    expect(results.find((r) => r.token === FCM_TOKEN)?.ok).toBe(false);
  });

  it('never prunes a device because its provider threw', async () => {
    // The damage here is permanent: `deviceGone` disables the row, so a transient outage
    // would silently cost a real patient every future notification.
    const expo = new FakeProvider();
    const fcm = new FakeProvider();
    fcm.mode = 'throw';

    const results = await router(expo, fcm).send([message(FCM_TOKEN)]);

    expect(results[0]?.deviceGone).toBe(false);
  });

  it('still reports deviceGone when the provider genuinely says so', async () => {
    const expo = new FakeProvider();
    const fcm = new FakeProvider();
    fcm.mode = 'device-gone';

    const results = await router(expo, fcm).send([message(FCM_TOKEN)]);

    expect(results[0]?.deviceGone).toBe(true);
  });

  it('is configured when either provider is', async () => {
    const expo = new FakeProvider();
    const fcm = new FakeProvider();

    // The normal state today: Expo needs no credential, FCM has no service account yet.
    fcm.configured = false;
    expect(router(expo, fcm).configured).toBe(true);

    expo.configured = false;
    expect(router(expo, fcm).configured).toBe(false);
  });
});
