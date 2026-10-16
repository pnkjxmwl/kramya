ALTER TABLE "Payment" ADD COLUMN "reconcileAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Refund" ADD COLUMN "reconcileAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Refund" ADD COLUMN "submittedAt" TIMESTAMP(3);
CREATE INDEX "Payment_status_reconcileAfter_idx" ON "Payment"("status", "reconcileAfter");
CREATE INDEX "Refund_status_reconcileAfter_idx" ON "Refund"("status", "reconcileAfter");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refund_bounds" CHECK ("amountPaise" >= 0 AND "refundedPaise" >= 0 AND "refundedPaise" <= "amountPaise");
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_positive_amount" CHECK ("amountPaise" > 0);
