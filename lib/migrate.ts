// Applies committed Drizzle migrations. Used as the Railway pre-deploy command:
//   npm run db:migrate
// Requires DATABASE_URL at deploy time. Never runs during image build.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Cannot run migrations.");
    process.exit(1);
  }
  const pool = new Pool({
    connectionString: url,
    max: 2,
    ssl: /railway|render|neon|amazonaws/i.test(url) ? { rejectUnauthorized: false } : undefined,
  });
  const db = drizzle(pool);
  console.log("Applying migrations from ./drizzle ...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
