-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AccountActionToken" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountActionToken_tokenHash_key" ON "AccountActionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountActionToken_accountId_kind_createdAt_idx" ON "AccountActionToken"("accountId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "AccountActionToken_expiresAt_idx" ON "AccountActionToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "AccountActionToken" ADD CONSTRAINT "AccountActionToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Account lifecycle proofs are private even if the platform enables public schemas.
ALTER TABLE public."AccountActionToken" ADD CONSTRAINT account_action_kind CHECK (kind IN ('VERIFY_EMAIL','RESET_PASSWORD','DELETE_ACCOUNT'));
ALTER TABLE public."AccountActionToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AccountActionToken" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public."AccountActionToken" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON public."AccountActionToken" FROM %I',r);
  END IF;
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."AccountActionToken" TO kramya_runtime;
CREATE POLICY action_read ON public."AccountActionToken" FOR SELECT TO kramya_runtime USING (
 "accountId"=kramya_private.ctx('account_id') OR (kramya_private.ctx('purpose')='account-action' AND "tokenHash"=kramya_private.ctx('action_hash'))
);
CREATE POLICY action_insert ON public."AccountActionToken" FOR INSERT TO kramya_runtime WITH CHECK ("accountId"=kramya_private.ctx('account_id'));
CREATE POLICY action_update ON public."AccountActionToken" FOR UPDATE TO kramya_runtime USING ("accountId"=kramya_private.ctx('account_id')) WITH CHECK ("accountId"=kramya_private.ctx('account_id'));
CREATE POLICY action_delete ON public."AccountActionToken" FOR DELETE TO kramya_runtime USING ("accountId"=kramya_private.ctx('account_id'));

-- Replace, rather than overlap, the existing read policy. An unguessable one-time
-- proof can identify its own account; it never authorizes arbitrary email lookup.
DROP POLICY account_read ON public."Account";
CREATE POLICY account_read ON public."Account" FOR SELECT TO kramya_runtime USING (
 kramya_private.system_context() OR id=kramya_private.ctx('account_id')
 OR (kramya_private.ctx('purpose')='auth' AND email=kramya_private.ctx('email'))
 OR (kramya_private.ctx('purpose')='auth-google' AND (email=kramya_private.ctx('email') OR "googleId"=kramya_private.ctx('google_sub')))
 OR (kramya_private.staff(kramya_private.ctx('hospital_id'),ARRAY['ADMIN']) AND email=kramya_private.ctx('email'))
 OR (kramya_private.ctx('purpose')='refresh' AND EXISTS(SELECT 1 FROM public."RefreshToken" r WHERE r."accountId"="Account".id AND r."tokenHash"=kramya_private.ctx('refresh_hash')))
 OR (kramya_private.ctx('purpose')='account-action' AND EXISTS(SELECT 1 FROM public."AccountActionToken" t WHERE t."accountId"="Account".id AND t."tokenHash"=kramya_private.ctx('action_hash')))
);
CREATE POLICY notification_delete ON public."Notification" FOR DELETE TO kramya_runtime USING ("accountId"=kramya_private.ctx('account_id'));
CREATE POLICY refresh_delete ON public."RefreshToken" FOR DELETE TO kramya_runtime USING ("accountId"=kramya_private.ctx('account_id'));
