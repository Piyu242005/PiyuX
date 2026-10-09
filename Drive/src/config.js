import "dotenv/config";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT, "data");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const UPLOAD_TMP = path.join(DATA_DIR, "uploads");

for (const d of [DATA_DIR, UPLOAD_TMP]) fs.mkdirSync(d, { recursive: true });

function readSecret() {
  // Production secrets should be provided through the hosting platform's
  // environment settings. Never try to persist secrets into an ephemeral
  // application directory in production.
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

export const config = {
  port: Number(process.env.PORT) || 3001,
  // Render and most container hosts route traffic to the port on all interfaces.
  host: process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  secret: readSecret(),
  publicUrl: (process.env.PUBLIC_URL || "").replace(/\/$/, ""),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 2 * 1024 * 1024 * 1024,
  // Max bytes per Telegram message. Files larger than this are transparently
  // split into multipart entries that reassemble on download. ~1.9 GiB keeps a
  // safe margin under Telegram's 2 GiB per-file cap.
  splitPartBytes: Number(process.env.SPLIT_PART_BYTES) || Math.floor(1.9 * 1024 * 1024 * 1024),
  apiPresets: (process.env.API_PRESETS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [id, hash] = s.split(":");
      return { id: id.trim(), hash: hash.trim() };
    }),
  isProd: process.env.NODE_ENV === "production",
};
