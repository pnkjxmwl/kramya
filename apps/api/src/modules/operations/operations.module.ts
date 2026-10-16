import { Controller, Get, Module, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Roles } from "../../common/decorators";
import { workerStatuses } from "../../common/worker-status";
import { env, paymentsConfigured } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsModule } from "../payments/payments.module";
import { RazorpayClient } from "../payments/razorpay.client";
import { NotificationsModule } from "../notifications/notifications.module";
import { FcmClient } from "../notifications/fcm.client";

@Roles("ADMIN")
@Controller("hospitals/:hospitalId/operations")
class OperationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayClient,
    private readonly fcm: FcmClient,
  ) {}

  @Get()
  async status(@Param("hospitalId") hospitalId: string) {
    const tenMinutesAgo = new Date(Date.now() - 600_000);
    const [payments, refunds] = await Promise.all([
      this.prisma.payment.count({
        where: {
          hospitalId,
          status: { in: ["CREATED", "PENDING"] },
          createdAt: { lt: tenMinutesAgo },
        },
      }),
      this.prisma.refund.count({
        where: {
          hospitalId,
          status: "PENDING",
          createdAt: { lt: tenMinutesAgo },
        },
      }),
    ]);
    return {
      checkedAt: new Date().toISOString(),
      availability: env().DEPLOYMENT_AVAILABILITY,
      paymentsConfigured: paymentsConfigured(),
      paymentMode: env().RAZORPAY_MODE,
      pushConfigured: this.fcm.configured,
      workers: workerStatuses(),
      backlog: {
        paymentsOlderThanTenMinutes: payments,
        refundsOlderThanTenMinutes: refunds,
      },
      releaseGate: "not-cleared",
      remainingEvidence: [
        "hosted-recovery-and-key-custody",
        "clinic-hour-availability",
        "payment-webhook-and-device-delivery",
        "final-acceptance-and-supervised-eta-pilot",
      ],
    };
  }

  @Post("preflight")
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async preflight() {
    const [payment, push] = await Promise.all([
      this.razorpay.preflight(),
      this.fcm.preflight(),
    ]);
    return {
      checkedAt: new Date().toISOString(),
      payment,
      push,
      limits:
        "Read-only authentication checks; no charge, webhook-delivery or device-receipt claim.",
    };
  }
}

@Module({
  imports: [PaymentsModule, NotificationsModule],
  controllers: [OperationsController],
})
export class OperationsModule {}
