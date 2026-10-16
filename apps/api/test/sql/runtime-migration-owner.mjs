// Run this generated SQL as a local test database superuser, never against hosted data.
// The canonical migration executes under a CREATEROLE owner without SUPERUSER,
// REPLICATION or BYPASSRLS. Every probe object and role is rolled back.
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL(
    '../../prisma/migrations/202610160005_runtime_database_role/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const tables = [
  'Account',
  'Department',
  'Doctor',
  'DoctorSchedule',
  'Hospital',
  'HospitalStaff',
  'Notification',
  'OPDSession',
  'Patient',
  'Payment',
  'PushToken',
  'QueueEntry',
  'QueuePolicy',
  'RefreshToken',
  'Refund',
  'AuditLog',
  'QueueEvent',
  'Consultation',
  '_prisma_migrations',
];
const probe = migration
  .replaceAll('kramya_runtime', 'kramya_runtime_owner_probe')
  .replaceAll('public', '__runtime_owner_probe');
process.stdout.write(`
\\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE kramya_migrator_owner_probe CREATEROLE NOLOGIN;
CREATE SCHEMA __runtime_owner_probe AUTHORIZATION kramya_migrator_owner_probe;
SET LOCAL ROLE kramya_migrator_owner_probe;
${tables.map((name) => `CREATE TABLE __runtime_owner_probe."${name}" (id text);`).join('\n')}
${probe}
RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kramya_runtime_owner_probe' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolreplication) THEN
    RAISE EXCEPTION 'restricted migration owner did not create the expected inactive role';
  END IF;
END $$;
ROLLBACK;
`);
