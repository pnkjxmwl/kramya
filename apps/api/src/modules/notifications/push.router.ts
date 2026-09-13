import { Injectable } from '@nestjs/common';
import { Expo } from 'expo-server-sdk';
import { ExpoClient, type ExpoApi, type PushMessage, type PushResult } from './expo.client';
import { FcmClient } from './fcm.client';

/**
 * Sends each message through whichever provider can actually reach that device.
 *
 * **Two patient apps now exist, and they hold different kinds of token.** `apps/mobile` is
 * built with Expo and registers an `ExponentPushToken[...]`; `apps/native` is an ordinary
 * Android app and registers an FCM registration token. Before this, every native token was
 * handed to the Expo SDK, rejected by its format check, reported as `deviceGone` and
 * pruned - so the native app could register successfully and then never receive anything,
 * with the only evidence being a disabled row.
 *
 * **The token's own shape is the discriminator, not `PushToken.platform`.** Platform says
 * "android", which both apps are; the token format says which service knows about this
 * device, which is the actual question. It also means no migration and no contract change:
 * `RegisterPushTokenRequest` already accepts any opaque string.
 *
 * This implements `ExpoApi` itself, so `NotificationsService` is unchanged apart from the
 * type it injects - the interface was left on `ExpoClient` for exactly this.
 */
@Injectable()
export class PushRouter implements ExpoApi {
  constructor(
    private readonly expo: ExpoClient,
    private readonly fcm: FcmClient,
  ) {}

  /**
   * True if EITHER provider can send.
   *
   * Expo needs no server credential so this is effectively always true today. It is
   * computed rather than hardcoded so that a deployment which somehow has neither
   * provider reports itself honestly.
   */
  get configured(): boolean {
    return this.expo.configured || this.fcm.configured;
  }

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const expoMessages: PushMessage[] = [];
    const fcmMessages: PushMessage[] = [];

    for (const message of messages) {
      if (Expo.isExpoPushToken(message.token)) expoMessages.push(message);
      else fcmMessages.push(message);
    }

    /*
      Both providers are asked at once, and neither can fail the other.

      A patient can hold tokens for both apps at the same time - which is the norm right
      now, with the native build installed beside the Expo one for comparison. Reaching ONE
      device is a delivered notification (NotificationsService decides that), so an outage
      at one provider must not take the other down with it. `allSettled` rather than `all`:
      a rejection here would lose the results of the provider that did work.
    */
    const [expoResults, fcmResults] = await Promise.allSettled([
      expoMessages.length > 0 ? this.expo.send(expoMessages) : Promise.resolve([]),
      fcmMessages.length > 0 ? this.fcm.send(fcmMessages) : Promise.resolve([]),
    ]);

    return [
      ...settled(expoResults, expoMessages, 'expo send failed'),
      ...settled(fcmResults, fcmMessages, 'fcm send failed'),
    ];
  }
}

/**
 * A provider that threw outright still owes one result per token, or the caller's
 * "reaching one device is enough" arithmetic silently counts fewer devices than it sent to.
 *
 * `deviceGone: false`, always: a provider throwing is a provider problem. Pruning a live
 * device because Expo had an outage would be permanent damage from a transient fault.
 */
function settled(
  outcome: PromiseSettledResult<PushResult[]>,
  sent: PushMessage[],
  fallback: string,
): PushResult[] {
  if (outcome.status === 'fulfilled') return outcome.value;
  const error = outcome.reason instanceof Error ? outcome.reason.message : fallback;
  return sent.map((message) => ({
    token: message.token,
    ok: false,
    deviceGone: false,
    error,
  }));
}
