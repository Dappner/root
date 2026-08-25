UV ?= $(shell command -v uv 2>/dev/null || echo "python3 -m uv")

APP_MODULE ?= app.main:app
HOST ?= 0.0.0.0
PORT ?= 8081

# Load environment variables from parent .env
ifneq (,$(wildcard ../.env))
    include ../.env
    export
endif

# Override with local .env if it exists
ifneq (,$(wildcard .env))
    include .env
    export
endif

install:
	@$(UV) sync

setup-hooks: install
	@$(UV) run pre-commit install
	@echo "Pre-commit hooks installed successfully!"

dev: install
	@$(UV) run uvicorn $(APP_MODULE) --reload --host $(HOST) --port $(PORT)

test: install
	@$(UV) run pytest

# Unit tests only — no database required.
test-unit: install
	@$(UV) run pytest -m "not integration"

# DB-backed integration tests. Requires TEST_DATABASE_URL pointing at a
# migrated Postgres (run `make test-db-up` in go-api once).
test-integration: install
	@$(UV) run pytest -m integration

format: install
	@$(UV) run ruff check --fix app tests
	@$(UV) run black app tests

lint: install
	@$(UV) run ruff check app tests

typecheck: install
	@$(UV) run mypy app

openapi: install
	@$(UV) run python scripts/generate_openapi.py

clone-remote-db:
	@$(UV) run python scripts/clone_db.py

clone-user-data:
	@$(UV) run python scripts/clone_user_data.py

clean:
	rm -rf __pycache__ */__pycache__ .venv .mypy_cache .pytest_cache .ruff_cache
