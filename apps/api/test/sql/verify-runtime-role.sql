-- Run as the migration owner on an isolated database. No fixture rows survive.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE public.__runtime_permission_probe (id integer);
DO $$
DECLARE attrs record;
BEGIN
  SELECT * INTO STRICT attrs FROM pg_roles WHERE rolname = 'kramya_runtime';
  IF attrs.rolsuper OR attrs.rolcreatedb OR attrs.rolcreaterole OR attrs.rolreplication OR attrs.rolbypassrls OR attrs.rolinherit THEN
    RAISE EXCEPTION 'runtime role has privileged attributes';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member = attrs.oid) THEN
    RAISE EXCEPTION 'runtime role has role memberships';
  END IF;
  IF has_schema_privilege('kramya_runtime', 'public', 'CREATE') OR
     has_table_privilege('kramya_runtime', 'public._prisma_migrations', 'SELECT,INSERT,UPDATE,DELETE') OR
     has_table_privilege('kramya_runtime', 'public.__runtime_permission_probe', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'runtime role can create schema objects, access migrations or access future tables';
  END IF;
END $$;

SET LOCAL ROLE kramya_runtime;
DO $$
DECLARE object_name text;
BEGIN
  FOREACH object_name IN ARRAY ARRAY[
    'Account','Department','Doctor','DoctorSchedule','Hospital','HospitalStaff',
    'Notification','OPDSession','Patient','Payment','PushToken','QueueEntry',
    'QueuePolicy','RefreshToken','Refund','AuditLog','QueueEvent','Consultation'
  ] LOOP
    EXECUTE format('SELECT * FROM public.%I LIMIT 0', object_name);
    EXECUTE format('INSERT INTO public.%I SELECT * FROM public.%I WHERE false', object_name, object_name);
    IF has_table_privilege(current_user, format('public.%I', object_name), 'TRUNCATE,REFERENCES,TRIGGER') THEN
      RAISE EXCEPTION 'runtime role has destructive/DDL privileges on %', object_name;
    END IF;
    IF object_name IN ('AuditLog','QueueEvent','Consultation') THEN
      BEGIN
        EXECUTE format('UPDATE public.%I SET id=id WHERE false', object_name);
        RAISE EXCEPTION 'runtime role can rewrite append-only %', object_name;
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE false', object_name);
        RAISE EXCEPTION 'runtime role can delete append-only %', object_name;
      EXCEPTION WHEN insufficient_privilege THEN NULL;
      END;
    ELSE
      EXECUTE format('UPDATE public.%I SET id=id WHERE false', object_name);
      EXECUTE format('DELETE FROM public.%I WHERE false', object_name);
    END IF;
  END LOOP;
  BEGIN
    EXECUTE 'CREATE TABLE public.__runtime_ddl_denied (id integer)';
    RAISE EXCEPTION 'runtime role can create application tables';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    EXECUTE 'SELECT * FROM public._prisma_migrations LIMIT 0';
    RAISE EXCEPTION 'runtime role can read migration history';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    EXECUTE 'DROP TABLE public.__runtime_permission_probe';
    RAISE EXCEPTION 'runtime role can drop owner tables';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
