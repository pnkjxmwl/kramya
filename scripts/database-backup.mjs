import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  appendFile,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

const MAGIC = Buffer.from('KRAMYADB1');
const HEADER_LENGTH = MAGIC.length + 12;
const BACKUP_DIRECTORY = resolve('.backups');
const IMAGE =
  'postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24';

export function parseDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('A valid PostgreSQL URL is required in the named environment variable');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    !url.username ||
    !url.password ||
    !/^\/[^/]+$/.test(url.pathname)
  ) {
    throw new Error('Expected a PostgreSQL host, user, password and database');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const local = ['localhost', '127.0.0.1', '::1', 'host.docker.internal'].includes(host);
  const sslmode = url.searchParams.get('sslmode') ?? (local ? 'disable' : 'require');
  if (
    !['require', 'verify-full', 'disable'].includes(sslmode) ||
    (!local && sslmode === 'disable')
  ) {
    throw new Error('Remote backups require TLS; supported modes are require and verify-full');
  }
  if (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public')
    throw new Error('This tool backs up the public application schema only');
  return {
    host,
    local,
    sslmode,
    port: url.port || '5432',
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

export function validateRestoreTarget(config) {
  if (!config.local || !/^kramya_restore_[a-z0-9_]+$/.test(config.database)) {
    throw new Error('Restore is restricted to a local, empty kramya_restore_* database');
  }
}

export function archivePath(value) {
  const path = resolve(value ?? '');
  const inside = relative(BACKUP_DIRECTORY, path);
  if (
    !inside ||
    isAbsolute(inside) ||
    inside.startsWith('..') ||
    dirname(path) !== BACKUP_DIRECTORY ||
    !/^[a-zA-Z0-9_.-]+\.kdb$/.test(basename(path))
  ) {
    throw new Error('Use a .kdb archive inside the local .backups directory');
  }
  return path;
}

async function encryptionKey() {
  if (process.env.BACKUP_ENCRYPTION_KEY && process.env.BACKUP_KEY_FILE)
    throw new Error('Choose one backup key source');
  const value = process.env.BACKUP_KEY_FILE
    ? (await readFile(process.env.BACKUP_KEY_FILE, 'utf8')).trim()
    : (process.env.BACKUP_ENCRYPTION_KEY ?? '');
  if (!/^[a-fA-F0-9]{64}$/.test(value))
    throw new Error(
      'Supply a 32-byte hex backup key through BACKUP_KEY_FILE or BACKUP_ENCRYPTION_KEY',
    );
  return Buffer.from(value, 'hex');
}

/** Writes only a new file; callers promote it to a final archive after pg_dump succeeds. */
export async function encryptStream(input, path, key) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(MAGIC);
  const output = createWriteStream(path, { flags: 'wx', mode: 0o600 });
  output.write(Buffer.concat([MAGIC, nonce]));
  await pipeline(input, cipher, output);
  await appendFile(path, cipher.getAuthTag());
}

/** Authentication must complete before pg_restore is allowed to see any plaintext. */
export async function decryptArchive(archive, plaintext, key) {
  const file = await open(archive, 'r');
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size <= HEADER_LENGTH + 16)
      throw new Error('Invalid encrypted backup');
    const header = Buffer.alloc(HEADER_LENGTH),
      tag = Buffer.alloc(16);
    await file.read(header, 0, HEADER_LENGTH, 0);
    await file.read(tag, 0, 16, info.size - 16);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC))
      throw new Error('Unsupported backup format');
    const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(MAGIC.length));
    decipher.setAAD(MAGIC);
    decipher.setAuthTag(tag);
    const output = await open(plaintext, 'wx', 0o600);
    try {
      await pipeline(
        createReadStream(archive, { start: HEADER_LENGTH, end: info.size - 17 }),
        decipher,
        output.createWriteStream(),
      );
    } catch {
      // This path was reserved by the caller; never pass unverified bytes to Postgres.
      await output.close();
      await unlink(plaintext).catch(() => {});
      throw new Error('Backup authentication failed or plaintext output could not be created');
    } finally {
      await output.close();
    }
  } finally {
    await file.close();
  }
}

export function publicRestoreList(list) {
  // A freshly created Postgres database already has public. Keep that schema;
  // do not DROP it or use --clean merely to replay pg_dump's CREATE SCHEMA entry.
  return list
    .split('\n')
    .filter((line) => !/^\d+;\s+\d+\s+\d+\s+SCHEMA\s+-\s+public\s/.test(line))
    .join('\n');
}

function pgTool(command, args, config, capture = false, dockerArgs = []) {
  const variables = {
    PGHOST: config.local ? 'host.docker.internal' : config.host,
    PGPORT: config.port,
    PGDATABASE: config.database,
    PGUSER: config.user,
    PGPASSWORD: config.password,
    PGSSLMODE: config.sslmode,
    PGCONNECT_TIMEOUT: '15',
  };
  const child = spawn(
    'docker',
    [
      'run',
      '--rm',
      '-i',
      ...dockerArgs,
      ...Object.keys(variables).flatMap((k) => ['--env', k]),
      IMAGE,
      command,
      ...args,
    ],
    {
      env: { ...process.env, ...variables },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  // Never print subprocess stderr: database tools may include connection details.
  child.stderr.resume();
  let text = '',
    overflow = false;
  if (capture)
    child.stdout.on('data', (data) => {
      if (text.length + data.length <= 1_048_576) text += data.toString();
      else overflow = true;
    });
  const done = new Promise((ok, fail) => {
    child.once('error', () => fail(new Error(`${command} could not start; check Docker`)));
    child.once('close', (code) =>
      code === 0 && !overflow
        ? ok(text)
        : fail(new Error(`${command} failed or exceeded the capture limit`)),
    );
  });
  return { child, done };
}

async function checksum(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function backup(path, key) {
  const config = parseDatabaseUrl(process.env.BACKUP_DATABASE_URL);
  const partial = `${path}.partial-${randomUUID()}`;
  const processHandle = pgTool(
    'pg_dump',
    [
      '--format=custom',
      '--schema=public',
      '--no-owner',
      '--no-privileges',
      '--lock-wait-timeout=10s',
    ],
    config,
  );
  processHandle.child.stdin.end();
  try {
    const writing = encryptStream(processHandle.child.stdout, partial, key).catch((error) => {
      processHandle.child.kill();
      throw error;
    });
    const results = await Promise.allSettled([writing, processHandle.done]);
    if (results.some((result) => result.status === 'rejected'))
      throw new Error('Backup did not complete; no final archive was published');
    // A hard link publishes atomically and refuses to overwrite an existing backup.
    await link(partial, path);
    process.stdout.write(
      JSON.stringify({
        archive: basename(path),
        bytes: (await stat(path)).size,
        sha256: await checksum(path),
        schema: 'public',
        encrypted: 'AES-256-GCM',
      }) + '\n',
    );
  } finally {
    await unlink(partial).catch(() => {});
  }
}

async function restore(path, key) {
  const target = parseDatabaseUrl(process.env.RESTORE_DATABASE_URL);
  validateRestoreTarget(target);
  const plaintext = resolve(BACKUP_DIRECTORY, `.restore-${randomUUID()}.dump`);
  const tocPath = resolve(BACKUP_DIRECTORY, `.restore-${randomUUID()}.list`);
  try {
    await decryptArchive(path, plaintext, key);
    const listing = pgTool('pg_restore', ['--list'], target, true);
    const listResults = await Promise.all([
      pipeline(createReadStream(plaintext), listing.child.stdin),
      listing.done,
    ]);
    await writeFile(tocPath, publicRestoreList(listResults[1]), { flag: 'wx', mode: 0o600 });
    const probe = pgTool(
      'psql',
      [
        '-X',
        '-A',
        '-t',
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        "SELECT count(*) FROM pg_tables WHERE schemaname='public'",
      ],
      target,
      true,
    );
    probe.child.stdin.end();
    if ((await probe.done).trim() !== '0')
      throw new Error('Restore target is not empty; no changes were made');
    const handle = pgTool(
      'pg_restore',
      [
        '--dbname',
        target.database,
        '--single-transaction',
        '--exit-on-error',
        '--no-owner',
        '--no-privileges',
        '--use-list=/tmp/kramya-restore.list',
      ],
      target,
      false,
      ['--mount', `type=bind,source=${tocPath},target=/tmp/kramya-restore.list,readonly`],
    );
    handle.child.stdout.resume();
    const feeding = pipeline(createReadStream(plaintext), handle.child.stdin).catch((error) => {
      handle.child.kill();
      throw error;
    });
    const results = await Promise.allSettled([feeding, handle.done]);
    if (results.some((result) => result.status === 'rejected'))
      throw new Error(
        'Restore failed; check the isolated target. No hosted target is permitted by this tool',
      );
    process.stdout.write(
      `Restored public schema into isolated local database ${target.database}. Verify row counts and application behavior separately.\n`,
    );
  } finally {
    await unlink(plaintext).catch(() => {});
    await unlink(tocPath).catch(() => {});
  }
}

async function main() {
  const [mode, value] = process.argv.slice(2);
  if (mode === 'init-key') {
    const keyPath = resolve(value ?? '');
    if (keyPath.startsWith(BACKUP_DIRECTORY) || !basename(keyPath).startsWith('.env.'))
      throw new Error('Store the key in a separate .env.* file outside .backups');
    await writeFile(keyPath, randomBytes(32).toString('hex') + '\n', { flag: 'wx', mode: 0o600 });
    process.stdout.write(
      'Backup key created without printing it. Store a separate recoverable copy in your password manager.\n',
    );
    return;
  }
  if (!['backup', 'restore'].includes(mode))
    throw new Error(
      'Usage: node scripts/database-backup.mjs init-key .env.backup-key | backup .backups/NAME.kdb | restore .backups/NAME.kdb',
    );
  const path = archivePath(value),
    key = await encryptionKey();
  await mkdir(BACKUP_DIRECTORY, { recursive: true, mode: 0o700 });
  if ((await lstat(BACKUP_DIRECTORY)).isSymbolicLink())
    throw new Error('Backup directory must not be a symlink');
  await (mode === 'backup' ? backup(path, key) : restore(path, key));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    process.stderr.write(
      'Database backup/restore failed. Check the command, Docker, named environment variables, key, archive and empty local restore target. Credentials and subprocess output were suppressed.\n',
    );
    process.exitCode = 1;
  });
}
