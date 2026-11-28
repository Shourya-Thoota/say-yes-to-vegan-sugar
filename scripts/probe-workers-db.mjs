#!/usr/bin/env node
/**
 * CI guard: proves the built Worker opens exactly one Postgres connection per
 * request and closes it once the response is done.
 *
 * It expects `.open-next/worker.js` (run the OpenNext build first). A fake
 * Postgres server answers the startup handshake with AuthenticationOk and
 * ReadyForQuery, then refuses the first query frame of each round trip with a
 * generic ErrorResponse (Sync gets ReadyForQuery, Terminate is recorded). It
 * records each TCP connect, whether the client sent Terminate, and the close.
 * `wrangler dev` then serves the
 * built Worker with DATABASE_URL pointed at that server, and two sequential
 * POSTs are sent to /api/support (which calls getDb() before doing anything
 * else). A regression that calls getDb() twice per request — the rate limiter
 * plus the handler — shows up as four connections instead of two, and a
 * connection that is never ended shows up as a missing Terminate/close. Query
 * counts are logged but never asserted: the guard is the connection lifecycle.
 */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const HOST = "127.0.0.1";
const WORKER_PORT = Number(process.env.PROBE_WORKER_PORT ?? 8791);
const INSPECTOR_PORT = WORKER_PORT + 2;
const REQUEST_COUNT = 2;
const PROBE_CONFIG = ".open-next/probe.wrangler.json";
const EXPECTED_STATUS = 422; // valid DB handle, invalid body -> validation error

const pgMessage = (type, body) => {
  const out = Buffer.alloc(5 + body.length);
  out.write(type, 0, 1, "ascii");
  out.writeInt32BE(4 + body.length, 1);
  body.copy(out, 5);
  return out;
};
const cstr = (value) => Buffer.concat([Buffer.from(value, "utf8"), Buffer.alloc(1)]);
const READY = pgMessage("Z", Buffer.from("I"));
const QUERY_ERROR = pgMessage(
  "E",
  Buffer.concat([
    Buffer.from("S"),
    cstr("ERROR"),
    Buffer.from("V"),
    cstr("ERROR"),
    Buffer.from("C"),
    cstr("XX000"),
    Buffer.from("M"),
    cstr("probe: queries are refused"),
    Buffer.alloc(1),
  ])
);

const connections = [];
const openSockets = new Set();

const pgServer = createServer((socket) => {
  openSockets.add(socket);
  socket.on("close", () => openSockets.delete(socket));
  socket.on("error", () => {});

  const record = { id: connections.length + 1, startup: false, terminated: false, closed: false, queries: 0 };
  connections.push(record);

  let buffer = Buffer.alloc(0);
  let startupDone = false;
  let refusedThisRound = false;

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      if (!startupDone) {
        // StartupMessage / SSLRequest: length includes itself, no type byte.
        if (buffer.length < 4) return;
        const length = buffer.readInt32BE(0);
        if (length < 8 || buffer.length < length) return;
        const frame = buffer.subarray(0, length);
        buffer = buffer.subarray(length);
        const code = frame.readInt32BE(4);
        if (code === 80877103) {
          socket.write(Buffer.from("N")); // SSLRequest -> "no TLS"
          continue;
        }
        if (code !== 196608) {
          socket.destroy();
          return;
        }
        startupDone = true;
        record.startup = true;
        // AuthenticationOk + ReadyForQuery is all node-postgres needs to move on.
        socket.write(Buffer.concat([pgMessage("R", Buffer.from([0, 0, 0, 0])), READY]));
        continue;
      }

      // Post-handshake frame: type byte + length (length excludes type).
      // Only Terminate and Sync need distinguishing; every other frame is
      // refused without parsing it, once per round trip.
      if (buffer.length < 5) return;
      const length = buffer.readInt32BE(1);
      const total = 1 + length;
      if (length < 4 || buffer.length < total) return;
      const type = String.fromCharCode(buffer[0]);
      buffer = buffer.subarray(total);

      if (type === "X") {
        record.terminated = true; // Terminate: the client ended the session
        continue;
      }
      if (type === "S") {
        // Sync: end of the extended-query round trip; ReadyForQuery flushes it.
        refusedThisRound = false;
        socket.write(READY);
        continue;
      }
      if (type === "Q") {
        // Simple query: error and ready in one response, no Sync follows.
        record.queries += 1;
        socket.write(Buffer.concat([QUERY_ERROR, READY]));
        continue;
      }
      if (!refusedThisRound) {
        refusedThisRound = true;
        record.queries += 1;
        socket.write(QUERY_ERROR);
      }
    }
  });

  socket.on("close", () => {
    record.closed = true;
  });
});

let worker;

function stopWorker() {
  if (!worker || worker.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(worker.pid), "/T", "/F"], { windowsHide: true });
  } else {
    try {
      process.kill(-worker.pid, "SIGTERM");
    } catch {
      worker.kill("SIGTERM");
    }
  }
}

function cleanup() {
  stopWorker();
  for (const socket of openSockets) socket.destroy();
  pgServer.close();
}

async function waitFor(predicate, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(100);
  }
  throw new Error(`timed out after ${timeoutMs}ms waiting for ${what}`);
}

async function main() {
  await new Promise((resolve, reject) => {
    pgServer.once("error", reject);
    pgServer.listen(0, HOST, resolve);
  });
  const pgPort = pgServer.address().port;

  writeFileSync(
    PROBE_CONFIG,
    JSON.stringify(
      {
        name: "temple-initiative-db-probe",
        main: "worker.js",
        compatibility_date: "2026-10-01",
        compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public", "enable_ctx_exports"],
        assets: { directory: "assets", binding: "ASSETS", run_worker_first: true },
        vars: { DATABASE_URL: `postgres://probe:probe@${HOST}:${pgPort}/probe` },
      },
      null,
      2
    )
  );

  // Run Wrangler's JS entry with the current Node binary: spawning npx.cmd
  // directly needs a shell on Windows and fails with EINVAL.
  const wranglerBin = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");
  worker = spawn(
    process.execPath,
    [
      wranglerBin,
      "dev",
      "--config",
      PROBE_CONFIG,
      "--ip",
      HOST,
      "--port",
      String(WORKER_PORT),
      "--inspector-port",
      String(INSPECTOR_PORT),
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" },
    }
  );

  let workerLog = "";
  worker.stdout.on("data", (data) => (workerLog += data));
  worker.stderr.on("data", (data) => (workerLog += data));

  const base = `http://${HOST}:${WORKER_PORT}`;
  let ready = false;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) break;
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  if (!ready) {
    throw new Error(`wrangler dev did not become ready.\n--- wrangler output (tail) ---\n${workerLog.slice(-4000)}`);
  }

  const statuses = [];
  for (let i = 0; i < REQUEST_COUNT; i++) {
    const res = await fetch(`${base}/api/support`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `probe-${i}` },
      body: "{}",
      signal: AbortSignal.timeout(30_000),
    });
    statuses.push(res.status);
    await res.arrayBuffer();
    await waitFor(() => connections.length >= i + 1, 15_000, `connection #${i + 1} to open`);
    await waitFor(() => connections[i]?.closed, 15_000, `connection #${i + 1} to close`);
  }
  await waitFor(() => connections.every((c) => c.closed), 10_000, "every connection to close");

  const failures = [];
  if (statuses.some((status) => status !== EXPECTED_STATUS)) {
    failures.push(`expected every probe request to return ${EXPECTED_STATUS}, got ${statuses.join(", ")}`);
  }
  if (connections.length !== REQUEST_COUNT) {
    failures.push(
      `expected ${REQUEST_COUNT} Postgres connections (one per request), saw ${connections.length}`
    );
  }
  for (const connection of connections) {
    if (!connection.startup) failures.push(`connection #${connection.id} never completed the startup handshake`);
    if (!connection.terminated) failures.push(`connection #${connection.id} never sent Terminate (not closed by the app)`);
    if (!connection.closed) failures.push(`connection #${connection.id} stayed open after its response`);
  }

  for (let i = 0; i < connections.length; i++) {
    const c = connections[i];
    console.log(
      `request ${i + 1} -> ${statuses[i] ?? "n/a"} | connection #${c.id}: startup=${c.startup} queries=${c.queries} terminate=${c.terminated} closed=${c.closed}`
    );
  }

  if (failures.length > 0) {
    throw new Error(`per-request Postgres connection check failed:\n- ${failures.join("\n- ")}`);
  }
  console.log(
    `OK: ${REQUEST_COUNT} requests opened ${connections.length} Postgres connections, each closed with a Terminate after its response.`
  );
}

main()
  .then(() => {
    cleanup();
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    cleanup();
    process.exit(1);
  });
