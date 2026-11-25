/**
 * Staged-upgrade regression coverage for the Drizzle journal timestamp fix.
 *
 * Background: drizzle-orm's PostgreSQL migrator (node-postgres, 0.36.4)
 * decides pending migrations with a SINGLE comparison:
 *
 *   SELECT ... ORDER BY created_at DESC LIMIT 1   -- latest applied entry
 *   for each migration in journal order:
 *     if (!lastDbMigration || lastDbMigration.created_at < migration.folderMillis) apply
 *
 * `idx` order is IRRELEVANT; only `max(created_at)` vs each file's journal
 * `when` (folderMillis) matters, evaluated once against the pre-run maximum.
 * A journal whose `when` values decrease (0003 < 0002) therefore applies
 * cleanly on a fresh database but is SILENTLY SKIPPED on any database that
 * already applied 0002 -- the hardening tables never appear, with no error.
 * This was proven empirically against real PostgreSQL before the fix:
 * staged 0001 -> 0002 -> full left `sponsorship_stripe_events` missing.
 *
 * What this file covers (all against isolated databases + the REAL
 * production migrator -- never hand-created tables, never string asserts):
 *   A. Fresh database -> all committed migrations apply.
 *   B. Staged 0001 -> 0002 -> 0003 via SEPARATE migrate() invocations
 *      (separate pools, modelling separate deploys), with synthetic rows
 *      inserted between stages that must survive.
 *   C. Database migrated through 0002 -> current set applies 0003.
 *   D. Re-running the current set is a clean no-op (no duplicates).
 *
 * Historical states are modelled with TEMPORARY migration directories
 * (exact byte-copies of the committed .sql files + a filtered copy of the
 * committed journal), so the checked-in files are never modified by tests.
 *
 * Runs ONLY when a test database is explicitly provided:
 *   - TEST_DATABASE_URL is set, OR
 *   - DATABASE_URL is set AND RUN_PG_TESTS=1
 * Otherwise the PG section skips cleanly. The journal-order assertion
 * (which needs no database) ALWAYS runs, so the timestamp invariant is
 * checked on every `npm test`, including database-less local runs.
 *
 * Safety: refuses production-like hosts; creates uniquely-named scratch
 * databases (`migtest_*`) and drops them afterwards; synthetic data only.
 */
import { describe, expect, it, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const TEST_URL =
  process.env.TEST_DATABASE_URL ||
  (process.env.RUN_PG_TESTS === "1" ? process.env.DATABASE_URL : undefined);

const PROD_PATTERN =
  /railway|render\.com|neon\.tech|amazonaws|say-yes-to-vegan-sugar-production/i;

if (TEST_URL && PROD_PATTERN.test(TEST_URL)) {
  throw new Error(
    "Refusing to run migration upgrade tests against a production-like DATABASE_URL."
  );
}

const enabled = Boolean(TEST_URL);
const pgDescribe = enabled ? describe : describe.skipIf(true);

// ---------------------------------------------------------------------------
// Committed-journal order check (no database needed -- always runs)
// ---------------------------------------------------------------------------
describe("drizzle journal timestamps are strictly increasing", () => {
  it("idx sequence is gapless and every `when` exceeds its predecessor", () => {
    const journalPath = path.resolve(
      process.cwd(),
      "drizzle/meta/_journal.json"
    );
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; when: number; tag: string }>;
    };
    expect(journal.entries.length).toBeGreaterThan(0);
    journal.entries.forEach((entry, i) => {
      expect(entry.idx).toBe(i);
      const sqlPath = path.resolve(process.cwd(), `drizzle/${entry.tag}.sql`);
      expect(
        fs.existsSync(sqlPath),
        `journal entry ${entry.tag} must have a matching SQL file`
      ).toBe(true);
      if (i > 0) {
        expect(
          entry.when,
          `journal entry ${entry.tag} (idx ${entry.idx}) must have a ` +
            `'when' strictly greater than its predecessor's`
        ).toBeGreaterThan(journal.entries[i - 1].when);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Staged-upgrade tests (isolated PostgreSQL via the real migrator)
// ---------------------------------------------------------------------------
const RUN_ID =
  `m${Date.now().toString(36)}${Math.floor(Math.random() * 0xffff).toString(36)}`
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);

const createdDbs: string[] = [];

function adminPool(): Pool {
  return new Pool({ connectionString: TEST_URL });
}

/** TEST_URL pointed at a scratch database (node-pg lets the connection
 *  string win over explicit params, so rewrite the database path instead). */
function connectionStringFor(dbname: string): string {
  const base = TEST_URL!;
  const q = base.indexOf("?");
  const head = q === -1 ? base : base.slice(0, q);
  const tail = q === -1 ? "" : base.slice(q);
  const prefix = "://";
  const slash = head.lastIndexOf("/");
  if (slash <= head.indexOf(prefix) + prefix.length) return `${head}/${dbname}${tail}`;
  return `${head.slice(0, slash + 1)}${dbname}${tail}`;
}

function dbName(stage: string): string {
  return `migtest_${RUN_ID}_${stage}`.slice(0, 60);
}

async function createScratchDb(name: string): Promise<void> {
  const admin = adminPool();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.query(`CREATE DATABASE "${name}"`);
    createdDbs.push(name);
  } finally {
    await admin.end();
  }
}

/** Exact byte-copies of the committed SQL files + filtered committed journal. */
function buildStageDir(tags: string[]): string {
  const journal = JSON.parse(
    fs.readFileSync(
      path.resolve(process.cwd(), "drizzle/meta/_journal.json"),
      "utf8"
    )
  ) as { entries: Array<{ tag: string }> } & Record<string, unknown>;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migstage-"));
  fs.mkdirSync(path.join(dir, "meta"));
  const sub = {
    ...journal,
    entries: (journal.entries as Array<{ tag: string }>).filter((e) =>
      tags.includes(e.tag)
    ),
  };
  expect(sub.entries.map((e) => e.tag)).toEqual(tags);
  fs.writeFileSync(
    path.join(dir, "meta", "_journal.json"),
    JSON.stringify(sub)
  );
  for (const tag of tags) {
    fs.copyFileSync(
      path.resolve(process.cwd(), `drizzle/${tag}.sql`),
      path.join(dir, `${tag}.sql`)
    );
  }
  return dir;
}

/** One migrate() invocation on its own pool/connection (models one deploy). */
async function runMigrate(dbname: string, dir: string): Promise<void> {
  const pool = new Pool({ connectionString: connectionStringFor(dbname) });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: dir });
  } finally {
    await pool.end();
  }
}

async function queryDb(
  dbname: string,
  text: string,
  params: unknown[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const pool = new Pool({ connectionString: connectionStringFor(dbname) });
  try {
    const res = await pool.query(text, params as never[]);
    return res.rows;
  } finally {
    await pool.end();
  }
}

async function historyWhens(dbname: string): Promise<number[]> {
  const rows = await queryDb(
    dbname,
    'SELECT created_at FROM drizzle."__drizzle_migrations" ORDER BY created_at'
  );
  return rows.map((r) => Number(r.created_at));
}

async function tableExists(dbname: string, table: string): Promise<boolean> {
  const rows = await queryDb(
    dbname,
    "SELECT 1 FROM information_schema.tables WHERE table_name = $1",
    [table]
  );
  return rows.length === 1;
}

async function columnExists(
  dbname: string,
  table: string,
  column: string
): Promise<boolean> {
  const rows = await queryDb(
    dbname,
    "SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2",
    [table, column]
  );
  return rows.length === 1;
}

const TAGS_0001 = ["0000_init", "0001_public_temple_directory"];
const TAGS_0002 = [...TAGS_0001, "0002_sponsorship_fulfillment"];
const TAGS_FULL = [...TAGS_0002, "0003_sponsorship_hardening"];

let keyCounter = 0;
function reqRef(): string {
  keyCounter += 1;
  return `MIG-${RUN_ID}-${keyCounter}`.slice(0, 16);
}
function orderRef(): string {
  keyCounter += 1;
  return `MIG-${RUN_ID}-${keyCounter}`.slice(0, 20);
}

async function insertLegacyRequest(
  dbname: string,
  opts: { consent?: boolean; status?: string } = {}
): Promise<{ id: string; publicRef: string; idem: string }> {
  keyCounter += 1;
  const publicRef = reqRef();
  const idem = `mig-${RUN_ID}-${keyCounter}`.slice(0, 64);
  // Deliberately OMIT the 0001 directory columns so the test proves the
  // additive defaults keep legacy-style rows strictly private.
  const rows = await queryDb(
    dbname,
    `INSERT INTO donation_requests
      (public_ref, idempotency_key, temple_name, street_address, city, state, zip_code,
       contact_name, contact_role, contact_email, quantity_pounds, intended_use)
     VALUES ($1,$2,'Synthetic Temple ${RUN_ID}','100 Test Ave','Houston','TX','77001',
       'Synthetic Contact','Volunteer',$3,50,'["prasadam"]'::jsonb)
     RETURNING id`,
    [publicRef, idem, `synthetic-${RUN_ID}-${keyCounter}@example.org`]
  );
  if (opts.consent !== undefined || opts.status !== undefined) {
    await queryDb(
      dbname,
      "UPDATE donation_requests SET public_listing_consent = COALESCE($2, public_listing_consent), public_listing_status = COALESCE($3, public_listing_status) WHERE id = $1",
      [rows[0].id, opts.consent ?? null, opts.status ?? null]
    );
  }
  return { id: rows[0].id as string, publicRef, idem };
}

async function insertOrder(
  dbname: string,
  sessionId: string
): Promise<{ id: string; publicRef: string }> {
  const publicRef = orderRef();
  const rows = await queryDb(
    dbname,
    `INSERT INTO sponsorship_orders
      (public_ref, stripe_checkout_session_id, tier_code, amount_cents, currency, estimated_pounds)
     VALUES ($1,$2,'bag_25',3500,'usd',25)
     RETURNING id`,
    [publicRef, sessionId]
  );
  return { id: rows[0].id as string, publicRef };
}

async function insertLedgerEntry(dbname: string): Promise<string> {
  const publicRef = orderRef();
  await queryDb(
    dbname,
    `INSERT INTO fulfillment_ledger
      (public_ref, recipient_label, pounds_delivered, sugar_product_label, delivered_at, recorded_by)
     VALUES ($1,'Synthetic Temple ${RUN_ID}',25,'Organic cane sugar, 25 lb',now(),$2)`,
    [publicRef, `synthetic-admin-${RUN_ID}@example.org`]
  );
  return publicRef;
}

pgDescribe(
  "migration staged upgrades (isolated PostgreSQL, real migrator)",
  () => {
    afterAll(async () => {
      // Drop only the scratch databases this run created.
      const admin = adminPool();
      try {
        for (const name of createdDbs) {
          await admin
            .query(`DROP DATABASE IF EXISTS "${name}"`)
            .catch(() => undefined);
        }
      } finally {
        await admin.end();
      }
    });

    it("A. fresh database applies every committed migration", async () => {
      const dbname = dbName("a");
      await createScratchDb(dbname);
      const dir = buildStageDir(TAGS_FULL);
      await runMigrate(dbname, dir);

      const journal = JSON.parse(
        fs.readFileSync(
          path.resolve(process.cwd(), "drizzle/meta/_journal.json"),
          "utf8"
        )
      ) as { entries: Array<{ when: number }> };
      expect(await historyWhens(dbname)).toEqual(
        journal.entries.map((e) => e.when)
      );

      for (const t of [
        "donation_requests",
        "sponsorship_orders",
        "fulfillment_ledger",
        "sponsorship_checkout_attempts",
        "sponsorship_stripe_events",
      ]) {
        expect(await tableExists(dbname, t), `${t} exists`).toBe(true);
      }
      for (const c of [
        "checkout_attempt_key",
        "terms_version",
        "terms_accepted_at",
        "refunded_amount_cents",
      ]) {
        expect(
          await columnExists(dbname, "sponsorship_orders", c),
          `sponsorship_orders.${c} exists`
        ).toBe(true);
      }
      expect(
        await columnExists(dbname, "fulfillment_ledger", "idempotency_key")
      ).toBe(true);
    }, 120_000);

    it("B. staged 0001 -> 0002 -> 0003 applies each step and keeps data", async () => {
      const dbname = dbName("b");
      await createScratchDb(dbname);

      // Stage 1: through 0001 (first deploy).
      await runMigrate(dbname, buildStageDir(TAGS_0001));
      expect((await historyWhens(dbname)).length).toBe(2);

      // Legacy-style request written before sponsorship tables existed.
      const req = await insertLegacyRequest(dbname);

      // Stage 2: separate invocation applies 0002 (second deploy).
      await runMigrate(dbname, buildStageDir(TAGS_0002));
      expect((await historyWhens(dbname)).length).toBe(3);
      expect(await tableExists(dbname, "sponsorship_orders")).toBe(true);
      expect(await tableExists(dbname, "fulfillment_ledger")).toBe(true);
      // The pre-existing request survived with strictly-private defaults.
      const keptReq = await queryDb(
        dbname,
        "SELECT public_listing_consent, public_listing_status, public_listing_consent_at FROM donation_requests WHERE id = $1",
        [req.id]
      );
      expect(keptReq.length).toBe(1);
      expect(keptReq[0].public_listing_consent).toBe(false);
      expect(keptReq[0].public_listing_status).toBe("private");

      // Orders written between the 0002 and 0003 deploys.
      const sessionId = `cs_mig_${RUN_ID}_b`;
      const order = await insertOrder(dbname, sessionId);
      const ledgerRef = await insertLedgerEntry(dbname);

      // Stage 3: separate invocation applies 0003 (third deploy).
      await runMigrate(dbname, buildStageDir(TAGS_FULL));
      const journal = JSON.parse(
        fs.readFileSync(
          path.resolve(process.cwd(), "drizzle/meta/_journal.json"),
          "utf8"
        )
      ) as { entries: Array<{ when: number }> };
      expect(await historyWhens(dbname)).toEqual(
        journal.entries.map((e) => e.when)
      );
      expect(await tableExists(dbname, "sponsorship_stripe_events")).toBe(
        true
      );
      expect(
        await tableExists(dbname, "sponsorship_checkout_attempts")
      ).toBe(true);

      // Every synthetic row survived the full staged upgrade.
      expect(
        (
          await queryDb(dbname, "SELECT id FROM donation_requests WHERE id = $1", [
            req.id,
          ])
        ).length
      ).toBe(1);
      const keptOrder = await queryDb(
        dbname,
        "SELECT status, terms_version, refunded_amount_cents FROM sponsorship_orders WHERE id = $1",
        [order.id]
      );
      expect(keptOrder.length).toBe(1);
      expect(keptOrder[0].status).toBe("pending");
      expect(keptOrder[0].terms_version).toBe("v1");
      expect(Number(keptOrder[0].refunded_amount_cents)).toBe(0);
      expect(
        (
          await queryDb(
            dbname,
            "SELECT public_ref FROM fulfillment_ledger WHERE public_ref = $1",
            [ledgerRef]
          )
        ).length
      ).toBe(1);
    }, 180_000);

    it("C. database at 0002 picks up 0003 from the current set", async () => {
      const dbname = dbName("c");
      await createScratchDb(dbname);
      await runMigrate(dbname, buildStageDir(TAGS_0002));
      expect(await tableExists(dbname, "sponsorship_orders")).toBe(true);
      expect(await tableExists(dbname, "sponsorship_stripe_events")).toBe(
        false
      );

      const req = await insertLegacyRequest(dbname);
      const order = await insertOrder(dbname, `cs_mig_${RUN_ID}_c`);

      await runMigrate(dbname, buildStageDir(TAGS_FULL));
      const journal = JSON.parse(
        fs.readFileSync(
          path.resolve(process.cwd(), "drizzle/meta/_journal.json"),
          "utf8"
        )
      ) as { entries: Array<{ when: number }> };
      expect(await historyWhens(dbname)).toEqual(
        journal.entries.map((e) => e.when)
      );
      expect(await tableExists(dbname, "sponsorship_stripe_events")).toBe(
        true
      );
      expect(
        await columnExists(dbname, "sponsorship_orders", "terms_version")
      ).toBe(true);
      // Pre-upgrade rows survived.
      expect(
        (
          await queryDb(dbname, "SELECT id FROM donation_requests WHERE id = $1", [
            req.id,
          ])
        ).length
      ).toBe(1);
      expect(
        (
          await queryDb(
            dbname,
            "SELECT id FROM sponsorship_orders WHERE id = $1",
            [order.id]
          )
        ).length
      ).toBe(1);
    }, 180_000);

    it("D. re-running the current set is a clean no-op", async () => {
      const dbname = dbName("d");
      await createScratchDb(dbname);
      await runMigrate(dbname, buildStageDir(TAGS_FULL));
      const before = await historyWhens(dbname);
      expect(before.length).toBe(4);

      await runMigrate(dbname, buildStageDir(TAGS_FULL));
      expect(await historyWhens(dbname)).toEqual(before);

      await runMigrate(dbname, buildStageDir(TAGS_FULL));
      expect(await historyWhens(dbname)).toEqual(before);
    }, 180_000);
  }
);
