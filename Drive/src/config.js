import "dotenv/config";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : process.env.VERCEL ? "/tmp/data" : path.join(ROOT, "data");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const UPLOAD_TMP = path.join(DATA_DIR, "uploads");

for (const d of [DATA_DIR, UPLOAD_TMP]) fs.mkdirSync(d, { recursive: true });

function readSecret() {
  if (process.env.SECRET && process.env.SECRET.length >= 32) return process.env.SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SECRET must be configured as an environment variable (at least 32 characters) in production.");
  }

  const envFile = path.join(ROOT, ".env");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const m = line.match(/^SECRET=(.+)$/);
      if (m && m[1].trim().length >= 32) return m[1].trim();
    }
  }

  const generated = randomBytes(32).toString("hex");
  const block = `SECRET=${generated}\n`;
  if (fs.existsSync(envFile)) {
    let txt = fs.readFileSync(envFile, "utf8");
    if (/^SECRET=/m.test(txt)) txt = txt.replace(/^SECRET=.*$/m, `SECRET=${generated}`);
    else txt = txt.replace(/\s*$/, "") + "\n" + block;
    fs.writeFileSync(envFile, txt);
  } else {
    fs.writeFileSync(envFile, block);
  }
  process.env.SECRET = generated;
  return generated;
}

const isProduction = process.env.NODE_ENV === "production";
const hasPersistentDisk = process.env.PERSISTENT_STORAGE === "true";

if (isProduction && !hasPersistentDisk && process.env.ALLOW_EPHEMERAL_STORAGE !== "true") {
  console.warn("[storage-warning] Persistent storage is not enabled. SQLite user data and Telegram sessions may be lost when the instance restarts or redeploys. Set PERSISTENT_STORAGE=true only after attaching durable storage.");
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  // Production services must bind to all interfaces so Render can detect the port.
  // Ignore HOST overrides in production; a stale dashboard value like 127.0.0.1
  // would make the service unreachable from outside its container.
  host: isProduction ? "0.0.0.0" : (process.env.HOST || "127.0.0.1"),
  secret: readSecret(),
  publicUrl: (process.env.PUBLIC_URL || "").replace(/\/$/, ""),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 2 * 1024 * 1024 * 1024,
  splitPartBytes: Number(process.env.SPLIT_PART_BYTES) || Math.floor(1.9 * 1024 * 1024 * 1024),
  apiPresets: (process.env.API_PRESETS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [id, hash] = s.split(":");
      return { id: id.trim(), hash: hash.trim() };
    }),
  isProd: isProduction,
  hasPersistentDisk,
};
