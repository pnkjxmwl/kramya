import { Module } from '@nestjs/common';
import { PUSH_CLIENT } from './push.token';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpoClient } from './expo.client';
import { FcmClient } from './fcm.client';
import { PushRouter } from './push.router';
import { DispatchSweeper } from './dispatch-sweeper';
import { EventNotifier } from './event-notifier';
import { LeaveNowNotifier } from './leave-now';
import { ConfigModule } from '../config/config.module';
import { EtaModule } from '../eta/eta.module';

/**
 * Notifications (docs/Architecture.md 13). Owns `Notification` and `PushToken`.
 *
 * It reads `QueueEvent` - the append-only timeline the queue module owns - which is
 * the same read-only exception `discovery` and `eta` have: it writes nothing there,
 * and reading the timeline is precisely how this module avoids being wired into
 * twelve command files.
 */
@Module({
  // ConfigModule for the hospital's arriveBeforeMins, EtaModule for when a patient
  // will actually be seen. Both through their services, never their tables.
  imports: [ConfigModule, EtaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    DispatchSweeper,
    EventNotifier,
    LeaveNowNotifier,
    // By hand, not by DI: both clients take an optional `Env`, and Nest reads that
    // parameter as an injectable `Object` it cannot resolve - the exact failure
    // RazorpayClient hit in Phase 5.
    { provide: ExpoClient, useFactory: () => new ExpoClient() },
    { provide: FcmClient, useFactory: () => new FcmClient() },
    /*
      What NotificationsService actually sends through.

      Two patient apps hold two kinds of token - an Expo one from apps/mobile, an FCM one
      from apps/native - and the router picks per token. Bound to a string key rather than
      a class so the service depends on the INTERFACE: swapping the provider, or turning
      sending off entirely, stays a one-line change here.
    */
    {
      provide: PUSH_CLIENT,
      useFactory: (expo: ExpoClient, fcm: FcmClient) => new PushRouter(expo, fcm),
      inject: [ExpoClient, FcmClient],
    },
  ],
  exports: [NotificationsService, EventNotifier, LeaveNowNotifier, DispatchSweeper],
})
export class NotificationsModule {}
