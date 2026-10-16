-- Kramya uses its NestJS API and Prisma for all application data access. It does not
-- use Supabase's anon/authenticated client roles. Keep those roles out of the app
-- schema even if the Data API is accidentally re-enabled in the future.
--
-- Supabase-specific roles do not exist in local/CI PostgreSQL, so guard each change.
-- Apply the same restriction to future Prisma-created tables and sequences, using
-- the role that owns this migration run (postgres in Supabase, opd in CI).
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I', role_name);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
        current_user,
        role_name
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
        current_user,
        role_name
      );
    END IF;
  END LOOP;
END $$;
