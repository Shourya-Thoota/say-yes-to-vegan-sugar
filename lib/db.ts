import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        process.env.PGSSL === "require" || /railway|render|neon|amazonaws/i.test(url)
          ? { rejectUnauthorized: false }
          : undefined,
    });
    pool.on("error", (err) => {
      console.error("[db] pool error", err instanceof Error ? err.message : err);
    });
  }
  return pool;
}

export function getDb(): NodePgDatabase<typeof schema> | null {
  const p = getPool();
  if (!p) return null;
  if (!db) db = drizzle(p, { schema });
  return db;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function checkDbReadable(): Promise<{ ok: boolean; latencyMs?: number }> {
  const p = getPool();
  if (!p) return { ok: false };
  const start = Date.now();
  try {
    const client = await p.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false };
  }
}
