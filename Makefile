# Root Makefile - Proxies to sub-project Makefiles
# Uses doppler for secrets management

REMOTE_USER_ID ?=
COMPOSE_LOCAL := docker compose -f docker-compose.local.yml
# Local stack's postgres (from docker-compose.local.yml). Seed/clone run on the
# host and talk to it over the published port.
LOCAL_DATABASE_URL := postgres://postgres:postgres@localhost:5432/root?sslmode=disable

.PHONY: help db wipe seed-db clone-user-data migrate-up migrate-status \
        migrate-to migrate-force dev-frontend test-rag lint-frontend \
        up up-build down down-v logs ps restart require-stack

# Default target
help:
	@echo "Root Makefile - Common Commands"
	@echo ""
	@echo "Database:"
	@echo "  make db              - Start PostgreSQL (Docker)"
	@echo "  make wipe            - Wipe database and volumes"
	@echo "  make migrate-up      - Run all migrations"
	@echo "  make migrate-status  - Check migration version"
	@echo "  make migrate-to N    - Migrate to specific version N"
	@echo "  make migrate-force N - Force migration version to N"
	@echo ""
	@echo "Data:"
	@echo "  make seed-db         - Seed local admin and clone remote user data"
	@echo "  make clone-user-data - Clone user data from remote to local DB"
	@echo ""
	@echo "Local stack (Docker Compose: postgres + auth-server + go-api + fast-api + nginx):"
	@echo "  make up              - Start the local stack (hot reload)"
	@echo "  make up-build        - Rebuild images and start"
	@echo "  make down            - Stop the stack (keeps DB data)"
	@echo "  make down-v          - Stop the stack and wipe the DB volume"
	@echo "  make restart         - Restart the stack"
	@echo "  make logs            - Follow stack logs"
	@echo "  make ps              - Show stack service status"
	@echo ""
	@echo "Development (run frontend on the host alongside the stack):"
	@echo "  make dev-frontend    - Start Next.js frontend (port 3000)"
	@echo ""
	@echo "Testing:"
	@echo "  make test-rag        - Run Python RAG service tests"
	@echo ""

# =============================================================================
# Database
# =============================================================================

db:
	@$(MAKE) -C go-api db

wipe:
	@$(MAKE) -C go-api wipe

migrate-up:
	@doppler run -- $(MAKE) -C go-api migrate-up

migrate-status:
	@doppler run -- $(MAKE) -C go-api migrate-status

migrate-to:
	@doppler run -- $(MAKE) -C go-api migrate-to $(filter-out $@,$(MAKECMDGOALS))

migrate-force:
	@doppler run -- $(MAKE) -C go-api migrate-force $(filter-out $@,$(MAKECMDGOALS))

# =============================================================================
# Data Management
# =============================================================================

# Fail fast with a clear message if the local stack isn't up (seed/clone need it).
require-stack:
	@curl -sf -o /dev/null http://localhost:8000/health || \
		{ echo "Local stack not reachable on :8000. Run 'make up' first."; exit 1; }

seed-db: require-stack
	@doppler run -- env DATABASE_URL="$(LOCAL_DATABASE_URL)" $(MAKE) -C scripts seed-db $(if $(REMOTE_USER_ID),REMOTE_USER_ID="$(REMOTE_USER_ID)",)

clone-user-data: require-stack
	@doppler run -- env DATABASE_URL="$(LOCAL_DATABASE_URL)" $(MAKE) -C scripts clone-user-data $(if $(REMOTE_USER_ID),REMOTE_USER_ID="$(REMOTE_USER_ID)",)

# =============================================================================
# Local Stack (Docker Compose)
# =============================================================================

up:
	@doppler run -- $(COMPOSE_LOCAL) up

up-build:
	@doppler run -- $(COMPOSE_LOCAL) up --build

down:
	@$(COMPOSE_LOCAL) down

down-v:
	@$(COMPOSE_LOCAL) down -v

restart:
	@$(COMPOSE_LOCAL) restart

logs:
	@$(COMPOSE_LOCAL) logs -f

ps:
	@$(COMPOSE_LOCAL) ps

# =============================================================================
# Development Servers
# =============================================================================

dev-frontend:
	@cd frontend && doppler run -- pnpm dev

# Testing
test-rag:
	@doppler run -- $(MAKE) -C fast-api test

# Catch-all for targets with arguments (migrate-to, migrate-force)
%:
	@:
