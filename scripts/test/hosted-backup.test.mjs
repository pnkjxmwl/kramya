import { generateKeyPairSync, randomBytes } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprint, sealKey, unsealKey } from "../hosted-backup.mjs";
test("public recipient can seal but only matching private recipient can restore", () => {
  const make = () =>
    generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
  const recipient = make(),
    other = make(),
    key = randomBytes(32);
  const sealed = sealKey(key, recipient.publicKey),
    fp = fingerprint(recipient.publicKey);
  assert.deepEqual(unsealKey(sealed, recipient.privateKey, fp), key);
  assert.throws(() => unsealKey(sealed, other.privateKey, fp));
  const damaged = Buffer.from(sealed, "base64");
  damaged[20] ^= 1;
  assert.throws(() =>
    unsealKey(damaged.toString("base64"), recipient.privateKey, fp),
  );
  assert.throws(() =>
    unsealKey(
      sealKey(Buffer.from("short"), recipient.publicKey),
      recipient.privateKey,
      fp,
    ),
  );
  assert.notEqual(sealed, key.toString("base64"));
});
