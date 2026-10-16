import { Module } from "@nestjs/common";
import { PUSH_CLIENT } from "./push.token";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { FcmClient } from "./fcm.client";
import { DispatchSweeper } from "./dispatch-sweeper";
import { EventNotifier } from "./event-notifier";
import { LeaveNowNotifier } from "./leave-now";
import { ConfigModule } from "../config/config.module";
import { EtaModule } from "../eta/eta.module";

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
    // By hand, not by DI: the client takes an optional `Env`, and Nest reads that
    // parameter as an injectable `Object` it cannot resolve - the exact failure
    // RazorpayClient hit in Phase 5.
    { provide: FcmClient, useFactory: () => new FcmClient() },
    { provide: PUSH_CLIENT, useExisting: FcmClient },
  ],
  exports: [
    NotificationsService,
    EventNotifier,
    LeaveNowNotifier,
    DispatchSweeper,
    FcmClient,
  ],
})
export class NotificationsModule {}
