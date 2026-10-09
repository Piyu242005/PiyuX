import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:net";

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  return port;
}

test("HTTP health endpoint responds with security headers", async (t) => {
  const port = await freePort();
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: String(port),
      SECRET: "test-secret-that-is-long-enough-for-tests-only",
      DATA_DIR: process.env.TMPDIR ? `${process.env.TMPDIR}/piyux-test-${process.pid}` : undefined
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let logs = "";
  child.stdout.on("data", (b) => { logs += b.toString(); });
  child.stderr.on("data", (b) => { logs += b.toString(); });
  t.after(() => child.kill("SIGTERM"));

  let response;
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) assert.fail(`server exited early: ${logs}`);
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/health`);
      break;
    } catch {
      await delay(200);
    }
  }
  assert.ok(response, `server did not start; logs: ${logs}`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
});
