import { defineConfig } from "drizzle-kit";

// auth-server owns the `auth` schema. The drizzle schema (src/db/schema.ts)
// defines the tables explicitly under pgSchema("auth") with snake_case columns.
// Migrations live in ./drizzle and are applied on startup (src/db/migrate.ts).
// Generate new ones after editing schema.ts with `bun run db:generate`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  schemaFilter: ["auth"],
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  casing: "snake_case",
});
