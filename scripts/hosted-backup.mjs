import {
  constants,
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { prepareMigrationUrl } from "./verify-migration-target.mjs";

const RECIPIENT = "config/staging-backup-recipient.pem";
const PRIVATE = ".env.backup-recipient.pem";
export function fingerprint(publicKey) {
  return createHash("sha256")
    .update(createPublicKey(publicKey).export({ type: "spki", format: "der" }))
    .digest("hex");
}
export function sealKey(key, publicKey) {
  return publicEncrypt(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    key,
  ).toString("base64");
}
export function unsealKey(sealed, privateKey, expectedFingerprint) {
  const publicKey = createPublicKey(createPrivateKey(privateKey)).export({
    type: "spki",
    format: "pem",
  });
  if (fingerprint(publicKey) !== expectedFingerprint)
    throw new Error("Wrong backup recipient");
  const key = privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(sealed, "base64"),
  );
  if (key.length !== 32) throw new Error("Invalid backup key");
  return key;
}
async function runTool(args, environment) {
  const child = spawn(
    process.execPath,
    ["scripts/database-backup.mjs", ...args],
    {
      windowsHide: true,
      stdio: "inherit",
      env: { ...process.env, BACKUP_KEY_FILE: "", ...environment },
    },
  );
  await new Promise((ok, fail) => {
    child.once("error", () => fail(new Error("Backup tool could not start")));
    child.once("close", (code) =>
      code === 0 ? ok() : fail(new Error("Backup tool failed")),
    );
  });
}
async function main() {
  const [mode, name] = process.argv.slice(2);
  if (mode === "init-recipient") {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 3072,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    await writeFile(PRIVATE, privateKey, { flag: "wx", mode: 0o600 });
    await mkdir("config", { recursive: true });
    await writeFile(RECIPIENT, publicKey, { flag: "wx" });
    console.log(
      `Recipient created. Private key stays in ${PRIVATE}; save a separate recoverable copy privately. Public fingerprint: ${fingerprint(publicKey)}`,
    );
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name ?? ""))
    throw new Error("Use a simple archive label");
  const archive = `.backups/${name}.kdb`,
    manifestPath = `.backups/${name}.json`;
  if (mode === "backup") {
    // Runner gets only the public recipient. No restore key is stored in GitHub.
    const publicKey = await readFile(RECIPIENT, "utf8");
    const key = randomBytes(32);
    try {
      const databaseUrl = prepareMigrationUrl(process.env.BACKUP_DATABASE_URL);
      await runTool(["backup", archive], {
        BACKUP_DATABASE_URL: databaseUrl,
        BACKUP_ENCRYPTION_KEY: key.toString("hex"),
      });
      const bytes = await readFile(archive);
      const manifest = {
        version: 1,
        projectId: "ejbrtjcioolhtyklhwly",
        schemas: ["public", "kramya_private"],
        createdAt: new Date().toISOString(),
        archive: `${name}.kdb`,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.length,
        keyEncryption: "RSA-OAEP-SHA256",
        recipientFingerprint: fingerprint(publicKey),
        wrappedKey: sealKey(key, publicKey),
      };
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", {
        flag: "wx",
      });
      console.log(`Encrypted hosted backup completed: ${manifest.sha256}`);
    } finally {
      key.fill(0);
    }
    return;
  }
  if (mode === "restore") {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (
      manifest.version !== 1 ||
      manifest.projectId !== "ejbrtjcioolhtyklhwly" ||
      JSON.stringify(manifest.schemas) !== '["public","kramya_private"]' ||
      manifest.archive !== `${name}.kdb` ||
      manifest.keyEncryption !== "RSA-OAEP-SHA256"
    )
      throw new Error("Unexpected backup manifest");
    const bytes = await readFile(archive);
    if (
      bytes.length !== manifest.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== manifest.sha256
    )
      throw new Error("Archive checksum mismatch");
    const key = unsealKey(
      manifest.wrappedKey,
      await readFile(PRIVATE, "utf8"),
      manifest.recipientFingerprint,
    );
    try {
      await runTool(["restore", archive], {
        BACKUP_ENCRYPTION_KEY: key.toString("hex"),
      });
    } finally {
      key.fill(0);
    }
    return;
  }
  throw new Error(
    "Usage: hosted-backup.mjs init-recipient | backup LABEL | restore LABEL",
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch(() => {
    console.error(
      "Hosted backup/restore failed. Check recipient, artifact, Docker and named environment variables. Credentials suppressed.",
    );
    process.exitCode = 1;
  });
}
