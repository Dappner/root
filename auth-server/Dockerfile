# syntax=docker/dockerfile:1

# --- deps: install production dependencies with a frozen lockfile ---
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- runtime: slim image running the Hono server directly via Bun ---
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# Ship the migration files so migrate-on-startup (src/db/migrate.ts) can apply them.
COPY drizzle ./drizzle
EXPOSE 8082
CMD ["bun", "src/index.ts"]
