-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "remoteBookingApprovedAt" TIMESTAMP(3);

-- Approval can be granted only by the owner-operated review command, never a
-- patient-scoped runtime update. Deletion may clear an existing approval.
CREATE FUNCTION kramya_private.guard_pilot_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW."remoteBookingApprovedAt" IS NOT NULL THEN RAISE EXCEPTION 'pilot approval requires operator review' USING ERRCODE='42501'; END IF;
  ELSIF NEW."remoteBookingApprovedAt" IS DISTINCT FROM OLD."remoteBookingApprovedAt" THEN
    IF NOT (NEW."remoteBookingApprovedAt" IS NULL AND NEW."deletedAt" IS NOT NULL AND OLD."deletionRequestedAt" IS NOT NULL AND kramya_private.ctx('purpose')='account-deletion') THEN
      RAISE EXCEPTION 'pilot approval requires operator review' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION kramya_private.guard_pilot_approval() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION kramya_private.guard_pilot_approval() TO kramya_runtime;
CREATE TRIGGER guard_pilot_approval BEFORE INSERT OR UPDATE ON public."Account"
FOR EACH ROW EXECUTE FUNCTION kramya_private.guard_pilot_approval();
