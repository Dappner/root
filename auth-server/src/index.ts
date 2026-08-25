import { auth } from "./auth";
import { runMigrations } from "./db/migrate";
import { Hono } from "hono";

// Apply pending auth-schema migrations before serving any traffic. auth-server
// owns the `auth` schema; the baseline is idempotent so this is a no-op against
// databases that already have the tables.
await runMigrations();

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export default {
  port: Number(process.env.PORT ?? 8082),
  fetch: app.fetch,
};
