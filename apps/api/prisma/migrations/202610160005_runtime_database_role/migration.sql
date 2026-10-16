-- Preparation for separating migration ownership from API runtime access.
-- NOLOGIN is intentional: creating grants must not activate an unused credential.
-- A separate operator cutover sets its password and enables LOGIN only after the
-- migration workflow and Render build/runtime secret separation have been verified.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kramya_runtime') THEN
    -- Non-privileged attributes are PostgreSQL defaults. Do not ALTER protected
    -- SUPERUSER/REPLICATION attributes: Supabase's postgres is not a superuser.
    CREATE ROLE kramya_runtime NOLOGIN NOINHERIT;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'kramya_runtime'
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit)
  ) OR EXISTS (
    SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
    WHERE r.rolname = 'kramya_runtime'
  ) OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE r.rolname = 'kramya_runtime'
  ) THEN
    RAISE EXCEPTION 'kramya_runtime must have restricted attributes, no owned objects and no role memberships';
  END IF;
END $$;

ALTER ROLE kramya_runtime SET statement_timeout = '30s';
ALTER ROLE kramya_runtime SET idle_in_transaction_session_timeout = '30s';

REVOKE ALL ON SCHEMA public FROM kramya_runtime;
GRANT USAGE ON SCHEMA public TO kramya_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM kramya_runtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM kramya_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public."Account", public."Department", public."Doctor", public."DoctorSchedule",
  public."Hospital", public."HospitalStaff", public."Notification", public."OPDSession",
  public."Patient", public."Payment", public."PushToken", public."QueueEntry",
  public."QueuePolicy", public."RefreshToken", public."Refund"
TO kramya_runtime;

-- These records are append-only in the running application. Seed/test operators
-- use their own credentials, not this runtime role.
GRANT SELECT, INSERT ON TABLE
  public."AuditLog", public."QueueEvent", public."Consultation"
TO kramya_runtime;

-- No migration-history access, schema creation, sequence rights or implicit
-- access to future tables. A new model needs a reviewed explicit grant migration.
REVOKE ALL ON TABLE public._prisma_migrations FROM kramya_runtime;
DO $$
BEGIN
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM kramya_runtime', current_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM kramya_runtime', current_user);
END $$;
