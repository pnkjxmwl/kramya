-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN     "receptionEmail" TEXT,
ADD COLUMN     "receptionPhone" TEXT;

-- Clinic admins maintain public details; listing approval stays operator-controlled.
CREATE FUNCTION kramya_private.guard_hospital_verification() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)
  ) THEN RAISE EXCEPTION 'listing status requires operator review' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION kramya_private.guard_hospital_verification() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION kramya_private.guard_hospital_verification() TO kramya_runtime;
CREATE TRIGGER guard_hospital_verification BEFORE UPDATE OF status ON public."Hospital"
FOR EACH ROW EXECUTE FUNCTION kramya_private.guard_hospital_verification();
