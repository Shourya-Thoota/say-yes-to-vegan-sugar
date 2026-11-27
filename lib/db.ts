import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import { after } from "next/server";
import * as schema from "./schema";

export type AppDatabase = NodePgDatabase<typeof schema>;

// Node/Railway path only: one pool for the lifetime of the process.
let pool: Pool | null = null;
let nodeDb: AppDatabase | null = null;

/**
 * True inside workerd. This is the same check pg uses to pick pg-cloudflare.
 * There, a TCP socket belongs to the request that opened it: reusing one in a
 * later request fails with "Cannot perform I/O on behalf of a different
 * request", so no connection may outlive its request.
 */
function isWorkersRuntime(): boolean {
  return (
    typeof navigator === "object" &&
    navigator !== null &&
    (navigator as { userAgent?: string }).userAgent === "Cloudflare-Workers"
  );
}

function sslConfig(url: string): { rejectUnauthorized: boolean } | undefined {
  const mode = process.env.PGSSL;
  if (mode === "disable") return undefined;
  if (mode === "require") return { rejectUnauthorized: false };
  // Managed providers terminate TLS with their own CA chain.
  if (/railway|render|neon|amazonaws/i.test(url)) return { rejectUnauthorized: false };
  // Railway's public TCP proxy (*.proxy.rlwy.net) is TLS-only, but its hostname
  // does not contain "railway", so match the proxy domain directly. This keeps
  // workers off a plaintext connection without needing a second secret.
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "rlwy.net" || host.endsWith(".rlwy.net")) return { rejectUnauthorized: false };
  } catch {
    // Let pg report a malformed connection string.
  }
  return undefined;
}

function connectionOptions(url: string) {
  return {
    connectionString: url,
    connectionTimeoutMillis: 10_000,
    ssl: sslConfig(url),
  };
}

/** Pooled handle for Node/Railway. Always null on Workers. */
export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url || isWorkersRuntime()) return null;
  if (!pool) {
    pool = new Pool({
      ...connectionOptions(url),
      max: 10,
      idleTimeoutMillis: 30_000,
    });
    pool.on("error", (err) => {
      console.error("[db] pool error", err instanceof Error ? err.message : err);
    });
  }
  return pool;
}

/**
 * Open a single connection for this request, closed once the response is done.
 * Queries are gated on the connection promise so a failed connect rejects them
 * instead of leaving them queued forever.
 */
function getRequestDb(url: string): AppDatabase {
  const client = new Client(connectionOptions(url));
  client.on("error", (err) => {
    console.error("[db] client error", err instanceof Error ? err.message : err);
  });
  const ready = client.connect();
  ready.catch(() => {
    // Surfaces through the gated queries below.
  });
  scheduleClose(client);
  const queryable = {
    query(queryConfig: unknown, values?: unknown) {
      return ready.then(() => client.query(queryConfig as never, values as never));
    },
  };
  return drizzle(queryable as unknown as Client, { schema });
}

function scheduleClose(client: Client): void {
  const close = async () => {
    await client.end().catch(() => {});
  };
  try {
    after(close);
  } catch {
    // Not running inside a request (e.g. a build-time render). Nothing to
    // defer to; the runtime tears the connection down with the request.
  }
}

export function getDb(): AppDatabase | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (isWorkersRuntime()) return getRequestDb(url);
  const p = getPool();
  if (!p) return null;
  if (!nodeDb) nodeDb = drizzle(p, { schema });
  return nodeDb;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function checkDbReadable(): Promise<{ ok: boolean; latencyMs?: number }> {
  const url = process.env.DATABASE_URL;
  if (!url) return { ok: false };
  const start = Date.now();

  if (isWorkersRuntime()) {
    const client = new Client(connectionOptions(url));
    client.on("error", () => {});
    try {
      await client.connect();
      await client.query("SELECT 1");
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false };
    } finally {
      await client.end().catch(() => {});
    }
  }

  const p = getPool();
  if (!p) return { ok: false };
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
