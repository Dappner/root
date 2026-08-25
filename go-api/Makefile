-include ../.env
export

.PHONY: dependencies dev db wipe build run dump-schema migration bootstrap-auth migrate-up migrate-status migrate-force migrate-to

# Install required development dependencies
dependencies:
	@echo "Installing development dependencies..."
	@echo "Installing golang-migrate CLI..."
	@go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
	@echo ""
	@echo "✅ All dependencies installed!"
	@echo ""

# Run the migration runner (applies migrations + serves /health)
dev: db migrate-up
	go run cmd/server/http/main.go

# Start local DB
db:
	@if ! docker compose ps | grep -q postgres.*running; then \
		echo "Starting database..."; \
		docker compose up -d; \
		echo "Waiting for database to be ready..."; \
		timeout=30; \
		while [ $$timeout -gt 0 ]; do \
			if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then \
				break; \
			fi; \
			sleep 1; \
			timeout=$$((timeout - 1)); \
		done; \
		if [ $$timeout -eq 0 ]; then \
			echo "Database failed to start"; \
			exit 1; \
		fi; \
	fi
	@echo "DB is Up!"

# Wipe db and volume
wipe:
	@docker compose down -v

# Build the binary
build:
	@go build -o bin/server cmd/server/http/main.go

# Run the built binary
run: build
	@./bin/server

# Dump database schema to file
dump-schema:
	@echo "Dumping database schema..."
	@docker compose exec -T postgres pg_dump --schema-only --no-owner --no-privileges -U postgres db > schema.sql
	@echo "Schema dumped to schema.sql"

MIGRATIONS_PATH = ./migrations/

# Create a new (forward-only) migration. Down migration is removed immediately.
migration:
	@name="$(filter-out $@,$(MAKECMDGOALS))"; \
	migrate create -seq -ext sql -dir $(MIGRATIONS_PATH) "$$name"; \
	rm -f "$(MIGRATIONS_PATH)"/*_"$$name".down.sql

# auth-server owns the `auth` schema (applied at runtime via its drizzle
# migrator). App migrations FK into auth."user", so when running go-api
# migrations standalone (without auth-server up) we first apply auth-server's
# idempotent baseline. Reuses the single source-of-truth SQL file — no
# duplicated DDL. The `--> statement-breakpoint` markers are drizzle annotations
# stripped before psql. No-op if auth-server already created the schema.
AUTH_BASELINE = ../auth-server/drizzle/0000_baseline_auth_schema.sql

bootstrap-auth:
	@echo "Bootstrapping auth schema (auth-server baseline)..."
	@sed 's/--> statement-breakpoint//' $(AUTH_BASELINE) \
		| psql "$(DATABASE_URL)" -v ON_ERROR_STOP=1 -f -

migrate-up: bootstrap-auth
	@echo "Running database migrations..."
	@migrate -path $(MIGRATIONS_PATH) -database "$(DATABASE_URL)" up
	@echo "Migrations completed successfully"

migrate-status:
	@echo "Checking migration status..."
	@migrate -path $(MIGRATIONS_PATH) -database "$(DATABASE_URL)" version

migrate-force:
	@VERSION="$(filter-out $@,$(MAKECMDGOALS))"; \
	if [ -z "$$VERSION" ]; then \
		echo "Usage: make migrate-force <version>"; \
		echo ""; \
		echo "Forces the migration version to the specified number."; \
		echo "This is used to fix 'dirty' migration states."; \
		echo ""; \
		echo "Common scenarios:"; \
		echo "  1. Migration partially applied: make migrate-force <current_version>"; \
		echo "  2. Migration failed completely: make migrate-force <previous_version>"; \
		echo ""; \
		echo "⚠️  WARNING: This does NOT run or rollback migrations!"; \
		echo "    It only updates the version number in schema_migrations."; \
		echo "    You may need to manually fix the database state first."; \
		echo ""; \
		echo "Example: make migrate-force 9"; \
		exit 1; \
	fi; \
	echo "⚠️  Forcing database migration version to $$VERSION..."; \
	migrate -path $(MIGRATIONS_PATH) -database "$(DATABASE_URL)" force $$VERSION; \
	echo "✅ Migration version forced successfully"

migrate-to:
	@VERSION="$(filter-out $@,$(MAKECMDGOALS))"; \
	if [ -z "$$VERSION" ]; then \
		echo "Usage: make migrate-to <version>"; \
		echo ""; \
		echo "Migrates the database to a specific version."; \
		echo "This runs migrations up or down as needed to reach the target version."; \
		echo ""; \
		echo "Example: make migrate-to 15"; \
		exit 1; \
	fi; \
	echo "🔄 Migrating database to version $$VERSION..."; \
	migrate -path $(MIGRATIONS_PATH) -database "$(DATABASE_URL)" goto $$VERSION; \
	echo "✅ Migration to version $$VERSION completed"

# Catch-all target to allow passing arguments to migrate-to/migrate-force/migration
%:
	@:
