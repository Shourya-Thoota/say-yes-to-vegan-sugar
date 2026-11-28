#!/usr/bin/env node
/**
 * Read-only readiness smoke check for DATABASE_URL.
 *
 * Sends two GET requests and writes nothing:
 *   /api/ready  -> 200 with { status: "ready" }
 *   /temples    -> 200 that is not the page's database-unavailable fallback
 *
 * The directory page catches database errors and still answers 200 with a
 * fallback message, so that marker is the real page-level assertion: a 200 on
 * its own does not prove Postgres is reachable.
 *
 * Usage:
 *   npm run smoke:db -- https://say-yes.example.org
 *   SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke:db
 */
const base = (
  process.argv[2] ??
  process.env.SMOKE_BASE_URL ??
  "http://127.0.0.1:3000"
).replace(/\/+$/, "");

const TIMEOUT_MS = 20_000;
const DIRECTORY_MARKER = "Temple directory";
const DIRECTORY_FALLBACK = "The directory is temporarily unavailable";

const failures = [];

async function get(path) {
  const res = await fetch(`${base}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "cache-control": "no-cache" },
  });
  return { res, body: await res.text() };
}

function pass(message) {
  console.log(`PASS  ${message}`);
}

function fail(message) {
  failures.push(message);
  console.log(`FAIL  ${message}`);
}

async function checkReady() {
  const { res, body } = await get("/api/ready");
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    // Reported below as a non-JSON body.
  }
  if (res.status === 200 && json?.status === "ready") {
    pass("GET /api/ready -> 200 ready");
    return;
  }
  const reason = json?.reason ? ` (${json.reason})` : "";
  const shape = json ? "" : ", body was not JSON";
  fail(`GET /api/ready -> ${res.status}${reason}${shape}`);
}

async function checkDirectory() {
  const { res, body } = await get("/temples");
  if (res.status !== 200) {
    fail(`GET /temples -> ${res.status}`);
    return;
  }
  if (body.includes(DIRECTORY_FALLBACK)) {
    fail("GET /temples -> 200 but rendered the database-unavailable fallback");
    return;
  }
  if (!body.includes(DIRECTORY_MARKER)) {
    fail("GET /temples -> 200 but the directory heading was missing");
    return;
  }
  pass("GET /temples -> 200 with live directory content");
}

console.log(`Smoke checking ${base} (read-only)\n`);

for (const check of [checkReady, checkDirectory]) {
  try {
    await check();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`${check.name} threw: ${message}`);
  }
}

console.log();
if (failures.length > 0) {
  console.log(`FAILED: ${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("OK: database is reachable through the app (no data written).");
