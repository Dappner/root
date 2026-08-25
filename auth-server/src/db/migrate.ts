import { db } from "./client";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Applies pending auth-schema migrations. The auth-server owns the `auth`
// schema: the baseline migration is idempotent so it is a no-op against
// existing dev/prod databases, and future migrations (bun run db:generate) run
// exactly once. drizzle tracks applied migrations in `drizzle.__drizzle_migrations`.
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: "drizzle" });
}

// Allow running migrations standalone: `bun src/db/migrate.ts` (db:migrate).
if (import.meta.main) {
  await runMigrations();
  process.exit(0);
}
