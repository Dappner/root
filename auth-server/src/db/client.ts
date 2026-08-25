import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const dbUrl = process.env.DATABASE_URL || "";
const requiresSsl = dbUrl.includes("sslmode=require");

const pool = new Pool({
  connectionString: dbUrl,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
