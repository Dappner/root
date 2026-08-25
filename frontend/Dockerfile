# syntax=docker/dockerfile:1

# ── Builder: produce the static SPA bundle (dist/) ──────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# Install deps (cached on lockfile)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build-time public config — Vite inlines VITE_* at build time, so these must be
# present as build args (real values come from Dokploy build args).
ARG VITE_RELEASE
ARG VITE_ENABLE_SIGNUP=false
ARG VITE_TURNSTILE_SITE_KEY
ARG VITE_APP_ENV
ENV VITE_RELEASE=${VITE_RELEASE} \
    VITE_ENABLE_SIGNUP=${VITE_ENABLE_SIGNUP} \
    VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY} \
    VITE_APP_ENV=${VITE_APP_ENV}

COPY . .
# Emits public/version.json, generates the route tree, and builds dist/.
RUN pnpm build

# ── Runtime: nginx serves dist/ (separate FE deploy, proxies to API_URL) ─────
FROM nginx:1.27-alpine AS runner

# SPA server block. The image's docker-entrypoint runs envsubst on
# /etc/nginx/templates/*.template → /etc/nginx/conf.d/ at startup; the FILTER
# scopes substitution to API_URL only, leaving nginx's own $vars untouched.
COPY default.conf.template /etc/nginx/templates/default.conf.template
ENV NGINX_ENVSUBST_FILTER=API_URL

# API_URL must be provided at run time (Dokploy env): the backend edge this FE
# forwards /api/auth + /rag-api to — e.g. https://api.dev.<host>. Default keeps
# `nginx -t` valid in CI/local smoke builds.
ENV API_URL=http://localhost:8000

# Static bundle.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1

# Default nginx image CMD already runs the envsubst entrypoint then nginx.
