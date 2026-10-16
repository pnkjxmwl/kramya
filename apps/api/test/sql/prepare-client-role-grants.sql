-- CI fixture only. Never run this against the hosted application database.
DO $$
BEGIN
  IF current_database() <> 'opd' OR current_user <> 'opd' THEN
    RAISE EXCEPTION 'This fixture requires the isolated opd CI database and owner';
  END IF;
END $$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO anon, authenticated;
