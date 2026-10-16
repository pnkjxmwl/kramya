import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import {
  parseDatabaseUrl,
  validateRestoreTarget,
  archivePath,
  encryptStream,
  decryptArchive,
  publicRestoreList,
} from '../database-backup.mjs';

async function cleanup(dir) {
  const target = await realpath(dir);
  if (
    dirname(target) !== (await realpath(tmpdir())) ||
    !basename(target).startsWith('kramya-backup-')
  )
    throw new Error('Unexpected temporary test directory');
  await rm(target, { recursive: true, force: true });
}

test('restore refuses a remote host and a non-rehearsal database', () => {
  for (const url of [
    'postgres://user:pass@example.com/kramya_restore_test',
    'postgres://user:pass@localhost/postgres',
  ]) {
    assert.throws(() => validateRestoreTarget(parseDatabaseUrl(url)));
  }
  assert.doesNotThrow(() =>
    validateRestoreTarget(
      parseDatabaseUrl('postgres://user:pass@localhost:5433/kramya_restore_test'),
    ),
  );
});
test('remote backup requires TLS and parser never includes the URL in errors', () => {
  assert.throws(
    () => parseDatabaseUrl('postgres://user:secret@example.com/app?sslmode=disable'),
    (error) => !error.message.includes('secret'),
  );
  assert.equal(parseDatabaseUrl('postgres://user:secret@example.com/app').sslmode, 'require');
  assert.equal(
    parseDatabaseUrl('postgres://user:encoded%40pass@localhost/app').password,
    'encoded@pass',
  );
});
test('archives cannot escape the ignored backup directory', () => {
  assert.throws(() => archivePath('.backups/../../source.kdb'));
  assert.throws(() => archivePath('backup.kdb'));
  assert.throws(() => archivePath('.backups/backup.sql'));
  assert.ok(archivePath('.backups/staging.kdb').endsWith('staging.kdb'));
});
test('restore keeps the existing empty public schema without dropping it', () => {
  const toc =
    '6; 2615 2200 SCHEMA - public pg_database_owner\n7; 1259 16400 TABLE public Account postgres\n8; 0 16400 TABLE DATA public Account postgres\n';
  const filtered = publicRestoreList(toc);
  assert.ok(!filtered.includes('SCHEMA - public'));
  assert.ok(filtered.includes('TABLE public Account'));
  assert.ok(filtered.includes('TABLE DATA public Account'));
});
test('encrypted stream authenticates and restores the original bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kramya-backup-'));
  try {
    const key = randomBytes(32),
      archive = join(dir, 'archive.kdb'),
      plain = join(dir, 'plain.dump');
    const bytes = Buffer.from('PGDMP fictional fixture, not patient data');
    await encryptStream(Readable.from(bytes), archive, key);
    assert.ok(!(await readFile(archive)).includes(bytes));
    await decryptArchive(archive, plain, key);
    assert.deepEqual(await readFile(plain), bytes);
    await assert.rejects(decryptArchive(archive, plain, key));
    assert.deepEqual(await readFile(plain), bytes);
  } finally {
    await cleanup(dir);
  }
});
test('wrong keys and corrupted archives leave no usable plaintext', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kramya-backup-'));
  try {
    const key = randomBytes(32),
      archive = join(dir, 'archive.kdb');
    await encryptStream(Readable.from(Buffer.from('PGDMP fictional fixture')), archive, key);
    const wrong = join(dir, 'wrong.dump');
    await assert.rejects(decryptArchive(archive, wrong, randomBytes(32)));
    await assert.rejects(access(wrong));
    const data = await readFile(archive);
    data[data.length - 18] ^= 1;
    await writeFile(archive, data);
    const corrupt = join(dir, 'corrupt.dump');
    await assert.rejects(decryptArchive(archive, corrupt, key));
    await assert.rejects(access(corrupt));
  } finally {
    await cleanup(dir);
  }
});
