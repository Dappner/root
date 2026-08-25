# Docker Compose Deployment

This docker-compose setup deploys the FastAPI backend behind an NGINX reverse
proxy for Dokploy, plus a Go migration runner that applies database migrations
on startup.

## Architecture

```
                    ┌─────────────────┐
                    │   NGINX :80     │
                    │  Reverse Proxy  │
                    └────────┬────────┘
                             │
                             │  /rag-api/*
                    ┌────────▼────────┐        ┌──────────────────┐
                    │    Fast API     │        │   go-api :8080   │
                    │      :8081      │        │ migration runner │
                    │   /rag-api/*    │        │  (/health only)  │
                    └────────┬────────┘        └────────┬─────────┘
                             │                          │
                             └────────────┬─────────────┘
                                          │
                                 External Services:
                                 • Neon DB (managed)
                                 • Frontend (separate)
```

`go-api` is not in the nginx request path. It runs migrations on startup
(`AUTO_MIGRATE=true`) and then idles serving `/health` for its container
healthcheck.

## Services

### Fast API (fast-api)
- **Port:** 8081
- **Endpoint:** `/rag-api/*`
- **Purpose:** The application backend — all CRUD, RAG queries, AI operations,
  and external service integration (R2, AssemblyAI, YouTube, LLMs)
- **Rate Limit:** 5 req/s (burst: 10)

### go-api migration runner (go-api)
- **Port:** 8080 (`/health` only; not proxied by nginx)
- **Purpose:** Applies `go-api/migrations/*.sql` on startup, then serves `/health`
- **Env:** `DATABASE_URL`, `PORT`, `APP_ENV`, `AUTO_MIGRATE`

### NGINX (nginx)
- **Port:** 80
- **Purpose:** Reverse proxy + rate limiting; forwards `/rag-api/*` to FastAPI
- **Depends on:** `fast-api` only

## Quick Start

### 1. Environment Variables

For production deployment, set environment variables directly in your deployment platform (e.g., Dokploy, Railway). For local testing with Docker Compose, you can use a `.env` file or export variables:

```bash
# Database (Neon)
DATABASE_URL=postgres://...

# Better Auth URL (for JWKS auth)
BETTER_AUTH_URL=https://your-frontend.com

# AI Services (Optional)
EMBEDDING_API_KEY=pa-xxx
OPENAI_API_KEY=sk-xxx
GOOGLE_API_KEY=xxx

# YouTube Proxy (Optional - for yt-dlp transcript fetching)
YOUTUBE_PROXY_USERNAME=your-proxy-username
YOUTUBE_PROXY_PASSWORD=your-proxy-password
YOUTUBE_PROXY_COUNTRY=US

# App Environment
APP_ENV=production
```

**Note**: For local development, use `doppler run` instead of managing `.env` files.

### 2. Deploy

```bash
docker-compose up -d
```

### 3. Access APIs

- Fast API: `http://localhost/rag-api/*`
- Health: `http://localhost/health`

## Configuration

### Rate Limits

Edit `nginx/rate-limit.conf`:
- `rag_limit`: Fast API rate (default: 5 req/s)

### NGINX Settings

Edit `nginx/nginx.conf` for:
- Timeouts
- Security headers
- Compression
- Proxy settings

## Useful Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f
docker-compose logs -f fast-api
docker-compose logs -f go-api      # migration output on startup

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Check service status
docker-compose ps

# Reload nginx after config changes (e.g. nginx.conf or rate-limit.conf)
docker-compose exec nginx nginx -s reload
```

## Notes

- Database is Neon DB (not included in compose)
- Frontend is deployed separately (not included in compose)
- fast-api and the go-api migration runner share the same Neon DB instance
- NGINX provides rate limiting and reverse proxy for fast-api
- Health checks are configured for all services
