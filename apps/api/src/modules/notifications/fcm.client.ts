import { Injectable, Logger } from '@nestjs/common';
import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { env, type Env } from '../../config/env';
import type { ExpoApi, PushMessage, PushResult } from './expo.client';

/**
 * The Firebase Cloud Messaging boundary.
 *
 * **Why this exists at all.** `ExpoClient` next door can only reach devices holding an
 * `ExponentPushToken[...]`, which means an Expo-built app. The native Android client in
 * `apps/native` is not one - it gets an ordinary FCM registration token, and Expo's SDK
 * rejects those outright and marks them `deviceGone`. Without this, every notification to
 * that app would be silently pruned as a dead device.
 *
 * It implements the SAME `ExpoApi` interface as the Expo client, so `NotificationsService`
 * cannot tell them apart: same `PushMessage` in, same `PushResult` out, same `deviceGone`
 * flag driving the same pruning. `PushRouter` picks between them per token.
 *
 * Thin on purpose, exactly like `ExpoClient` and `RazorpayClient`: one class owns the
 * network call, so a test can replace it and nothing else in the codebase knows a third
 * party exists.
 */
@Injectable()
export class FcmClient implements ExpoApi {
  private readonly log = new Logger(FcmClient.name);
  private readonly app: App | null;

  constructor(private readonly config: Env = env()) {
    this.app = initialiseApp(this.config, this.log);
  }

  /**
   * Unlike Expo, FCM genuinely needs a server credential.
   *
   * False when `FIREBASE_SERVICE_ACCOUNT` is unset, which is the default - so the API
   * boots, still RECORDS every notification, and simply cannot deliver to native clients.
   * The same posture `EXPO_ACCESS_TOKEN` and the Razorpay keys already take, so a
   * contributor with no Firebase project can run everything else.
   */
  get configured(): boolean {
    return this.app !== null;
  }

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    if (this.app === null) {
      // Not a device problem, so nothing is pruned: a deployment that later gains a
      // service account must be able to reach these devices.
      return messages.map((message) => ({
        token: message.token,
        ok: false,
        deviceGone: false,
        error: 'FCM is not configured',
      }));
    }

    const messaging = getMessaging(this.app);

    /*
      `notification` AND `data`, not data-only.

      A data-only message is handled by the app, which means it is not shown at all when
      the process has been killed - and a phone that has been in a pocket for an hour is
      exactly the case these notifications exist for. A `notification` block is rendered by
      the system tray whatever state the app is in, and the `data` rides along so a tap
      still deep-links to the right booking.
    */
    const sends = messages.map(async (message): Promise<PushResult> => {
      const payload: Message = {
        token: message.token,
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: {
          // Matches Expo's `priority: 'high'` - this has to wake a dozing device.
          priority: 'high',
          // Matches Expo's `ttl: 60 * 30`. A queue nudge is worthless late: FCM drops it
          // rather than delivering "you are next" an hour after the patient was seen.
          // Expressed in millis here, seconds there.
          ttl: 30 * 60 * 1000,
          notification: {
            // The channel apps/native creates at HIGH importance. Naming a channel that
            // does not exist on the device means Android shows nothing at all on API 26+.
            channelId: 'queue',
            sound: 'default',
          },
        },
      };

      try {
        await messaging.send(payload);
        return { token: message.token, ok: true, deviceGone: false };
      } catch (error) {
        const code = (error as { code?: string } | undefined)?.code ?? '';
        /*
          The two codes worth acting on, and the only ones.

          `registration-token-not-registered` is FCM's `DeviceNotRegistered`: the app was
          uninstalled or the token rotated. `invalid-argument` on a send keyed by token
          means the token is malformed. Both are dead rows rather than transient failures,
          so they are reported as `deviceGone` and the existing pruning disables them.
          Everything else - quota, transport, an FCM outage - is worth retrying.
        */
        const deviceGone =
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument';

        if (!deviceGone) this.log.error({ err: error }, 'fcm push failed');

        return {
          token: message.token,
          ok: false,
          deviceGone,
          error: error instanceof Error ? error.message : 'fcm send failed',
        };
      }
    });

    // One request per token rather than a multicast: the result has to be attributable to
    // a token for pruning to work, and `sendEachForMulticast` gives back a positional
    // array that has to be re-zipped anyway. These batches are a handful of devices.
    return Promise.all(sends);
  }
}

/**
 * Builds the Firebase app once, or returns null when there is no credential.
 *
 * `FIREBASE_SERVICE_ACCOUNT` holds the service-account JSON, base64-encoded. Base64
 * because the raw JSON contains newlines inside `private_key`, and every hosting panel
 * mangles those differently - Render included. One opaque string cannot be mangled.
 *
 * **A malformed credential must not stop the API booting.** It is logged and treated as
 * "not configured": an unreadable Firebase key is a degraded notification channel, not a
 * reason a hospital cannot run its queue.
 */
function initialiseApp(config: Env, log: Logger): App | null {
  if (config.FIREBASE_SERVICE_ACCOUNT === '') return null;

  // Nest can instantiate this class more than once across a test suite, and
  // initializeApp throws on a duplicate name.
  const existing = getApps().find((app) => app.name === FIREBASE_APP_NAME);
  if (existing !== undefined) return getApp(FIREBASE_APP_NAME);

  try {
    const decoded = Buffer.from(config.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
    const credentials = JSON.parse(decoded) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };

    if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
      log.error('FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email or private_key');
      return null;
    }

    return initializeApp(
      {
        credential: cert({
          projectId: credentials.project_id,
          clientEmail: credentials.client_email,
          privateKey: credentials.private_key,
        }),
      },
      FIREBASE_APP_NAME,
    );
  } catch (error) {
    log.error({ err: error }, 'FIREBASE_SERVICE_ACCOUNT could not be read - FCM push is off');
    return null;
  }
}

const FIREBASE_APP_NAME = 'kramya-push';
