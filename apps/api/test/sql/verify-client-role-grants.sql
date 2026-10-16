-- CI fixture only. A rolled-back probe checks future defaults as well as all
-- existing application objects. The identity column exercises sequence grants.
BEGIN;
CREATE TABLE public.__client_grant_probe (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
);

DO $$
DECLARE
  target_role text;
  object_name text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOR object_name IN
      SELECT format('%I.%I', schemaname, tablename)
      FROM pg_tables WHERE schemaname = 'public'
    LOOP
      IF has_table_privilege(target_role, object_name, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
        RAISE EXCEPTION '% retains privileges on %', target_role, object_name;
      END IF;
    END LOOP;
    FOR object_name IN
      SELECT format('%I.%I', schemaname, sequencename)
      FROM pg_sequences WHERE schemaname = 'public'
    LOOP
      IF has_sequence_privilege(target_role, object_name, 'USAGE, SELECT, UPDATE') THEN
        RAISE EXCEPTION '% retains privileges on sequence %', target_role, object_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;
ROLLBACK;
