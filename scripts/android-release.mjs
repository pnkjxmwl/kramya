import { randomBytes } from "node:crypto";
import { readFile, writeFile, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";

const settings = resolve(".env.android-signing.json");
async function run(program, args, options = {}) {
  const child = spawn(program, args, { windowsHide: true, ...options });
  await new Promise((ok, fail) => {
    child.once("error", () =>
      fail(new Error("Release command could not start")),
    );
    child.once("close", (code) =>
      code === 0 ? ok() : fail(new Error("Release command failed")),
    );
  });
}
async function main() {
  const mode = process.argv[2];
  if (mode === "init-staging-key") {
    // A new local staging identity; never overwrite an existing upload key.
    try {
      await access(settings);
      throw new Error("Signing settings already exist");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const file = resolve(".env.android-staging.p12");
    try {
      await access(file);
      throw new Error("Keystore already exists");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const password = randomBytes(32).toString("base64url");
    const values = {
      KRAMYA_UPLOAD_STORE_FILE: file,
      KRAMYA_UPLOAD_STORE_PASSWORD: password,
      KRAMYA_UPLOAD_KEY_ALIAS: "kramya-staging",
      KRAMYA_UPLOAD_KEY_PASSWORD: password,
    };
    const keytool = join(
      process.env.JAVA_HOME ?? "",
      "bin",
      process.platform === "win32" ? "keytool.exe" : "keytool",
    );
    await run(
      keytool,
      [
        "-genkeypair",
        "-noprompt",
        "-keystore",
        file,
        "-storetype",
        "PKCS12",
        "-alias",
        values.KRAMYA_UPLOAD_KEY_ALIAS,
        "-keyalg",
        "RSA",
        "-keysize",
        "3072",
        "-validity",
        "10000",
        "-dname",
        "CN=Kramya Staging, O=Kramya, C=IN",
        "-storepass:env",
        "KRAMYA_UPLOAD_STORE_PASSWORD",
        "-keypass:env",
        "KRAMYA_UPLOAD_KEY_PASSWORD",
      ],
      { env: { ...process.env, ...values }, stdio: "ignore" },
    );
    await writeFile(settings, JSON.stringify(values, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      "Local staging signing key created. Back up the ignored keystore and signing settings privately; neither is printed or uploaded.",
    );
    return;
  }
  if (mode !== "build")
    throw new Error("Usage: android-release.mjs init-staging-key | build");
  const values = JSON.parse(await readFile(settings, "utf8"));
  const firebase = JSON.parse(
    await readFile("apps/native/app/google-services.json", "utf8"),
  );
  if (
    firebase.project_info?.project_id !== "kramya-39390" ||
    !firebase.client?.some(
      (c) =>
        c.client_info?.android_client_info?.package_name ===
        "com.kramya.native",
    )
  )
    throw new Error("Firebase release project/package mismatch");
  const options = {
    cwd: resolve("apps/native"),
    env: { ...process.env, ...values },
    stdio: "inherit",
  };
  if (process.platform === "win32")
    await run(
      "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        "gradlew.bat --no-daemon testReleaseUnitTest assembleRelease bundleRelease",
      ],
      options,
    );
  else
    await run(
      "bash",
      [
        "gradlew",
        "--no-daemon",
        "testReleaseUnitTest",
        "assembleRelease",
        "bundleRelease",
      ],
      options,
    );
}
main().catch(() => {
  console.error(
    "Android release command failed. Check local signing settings, JDK, Android SDK and build diagnostics. Credentials suppressed.",
  );
  process.exitCode = 1;
});
