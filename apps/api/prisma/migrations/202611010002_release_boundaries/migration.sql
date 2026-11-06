-- AlterTable
ALTER TABLE "QueuePolicy" ADD COLUMN     "arrivalInstructions" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "DeploymentIdentity" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,

    CONSTRAINT "DeploymentIdentity_pkey" PRIMARY KEY ("id")
);

INSERT INTO public."DeploymentIdentity" (id, environment) VALUES ('singleton','STAGING');
ALTER TABLE public."DeploymentIdentity" ADD CONSTRAINT deployment_singleton CHECK (id='singleton');
ALTER TABLE public."DeploymentIdentity" ADD CONSTRAINT deployment_environment CHECK (environment IN ('STAGING','PRODUCTION'));
ALTER TABLE public."DeploymentIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DeploymentIdentity" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public."DeploymentIdentity" FROM PUBLIC;
GRANT SELECT ON public."DeploymentIdentity" TO kramya_runtime;
CREATE POLICY deployment_read ON public."DeploymentIdentity" FOR SELECT TO kramya_runtime USING (true);

-- CreateTable
CREATE TABLE "BookingAccess" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "pausedUntil" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingAccess_patientId_idx" ON "BookingAccess"("patientId");

-- CreateIndex
CREATE INDEX "BookingAccess_reviewedBy_idx" ON "BookingAccess"("reviewedBy");

-- CreateIndex
CREATE UNIQUE INDEX "BookingAccess_hospitalId_patientId_key" ON "BookingAccess"("hospitalId", "patientId");

-- AddForeignKey
ALTER TABLE "BookingAccess" ADD CONSTRAINT "BookingAccess_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAccess" ADD CONSTRAINT "BookingAccess_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAccess" ADD CONSTRAINT "BookingAccess_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Private runtime access only; catalog API roles must not gain new table grants.
ALTER TABLE public."BookingAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BookingAccess" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public."BookingAccess" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON public."BookingAccess", public."DeploymentIdentity" FROM %I',r);
    END IF;
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."BookingAccess" TO kramya_runtime;
CREATE POLICY booking_access_read ON public."BookingAccess" FOR SELECT TO kramya_runtime USING (
  kramya_private.staff("hospitalId", ARRAY['ADMIN','RECEPTION']) OR EXISTS (
    SELECT 1 FROM public."Patient" p WHERE p.id="BookingAccess"."patientId" AND p."accountId"=kramya_private.ctx('account_id')
  )
);
CREATE POLICY booking_access_insert ON public."BookingAccess" FOR INSERT TO kramya_runtime WITH CHECK (
  kramya_private.staff("hospitalId", ARRAY['ADMIN','RECEPTION']) AND "reviewedBy"=kramya_private.ctx('account_id') AND EXISTS (
    SELECT 1 FROM public."QueueEntry" q WHERE q."patientId"="BookingAccess"."patientId" AND q."hospitalId"="BookingAccess"."hospitalId" AND q."accountId" IS NOT NULL
  )
);
CREATE POLICY booking_access_update ON public."BookingAccess" FOR UPDATE TO kramya_runtime
USING (kramya_private.staff("hospitalId", ARRAY['ADMIN','RECEPTION']))
WITH CHECK (kramya_private.staff("hospitalId", ARRAY['ADMIN','RECEPTION']) AND "reviewedBy"=kramya_private.ctx('account_id') AND EXISTS (
  SELECT 1 FROM public."QueueEntry" q WHERE q."patientId"="BookingAccess"."patientId" AND q."hospitalId"="BookingAccess"."hospitalId" AND q."accountId" IS NOT NULL
));
CREATE POLICY booking_access_delete ON public."BookingAccess" FOR DELETE TO kramya_runtime USING (
  kramya_private.ctx('purpose')='account-deletion' AND EXISTS (
    SELECT 1 FROM public."Patient" p WHERE p.id="BookingAccess"."patientId" AND p."accountId"=kramya_private.ctx('account_id')
  )
);
ALTER TABLE public."BookingAccess" ADD CONSTRAINT booking_review_reason CHECK (char_length(reason) BETWEEN 10 AND 500);
ALTER TABLE public."BookingAccess" ADD CONSTRAINT booking_pause_bound CHECK ("pausedUntil" IS NULL OR ("pausedUntil">"reviewedAt" AND "pausedUntil"<="reviewedAt"+interval '7 days'));
