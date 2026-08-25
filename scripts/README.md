# Scripts

Utility scripts for database management, deployment, and troubleshooting.

## Migration Scripts

### fix-dirty-migration.sh

Interactive diagnostic and recovery tool for "dirty" database migrations.

**Usage:**
```bash
export DATABASE_URL='postgres://user:pass@host:port/dbname?sslmode=disable'
./scripts/fix-dirty-migration.sh
```

**What it does:**
- Checks current migration status
- Detects dirty migrations
- Shows which migration file is involved
- Provides recovery recommendations
- Can automatically check if migration was applied (for migration 9)

**When to use:**
- After seeing "Dirty database version" error
- Before manually running `make migrate-force`
- To diagnose migration issues in production

**See also:** `go-api/AGENTS.md` (migration troubleshooting section)

## Deployment Scripts

### setup-env.sh

Sets up environment variables for local development.

**Usage:**
```bash
./scripts/setup-env.sh
```

**What it does:**
- Copies `.env.example` to `.env` if not exists
- Generates secure random values for secrets
- Validates environment configuration

### backup-db.sh

Creates a backup of the database.

**Usage:**
```bash
export DATABASE_URL='postgres://user:pass@host:port/dbname'
./scripts/backup-db.sh
```

**Output:**
- Backup file: `backups/db-backup-YYYY-MM-DD-HHMMSS.sql`

### clone_user_data.py

Clones a user's data from remote to local database for development/testing.

**Usage:**
```bash
python scripts/clone_user_data.py --remote-user <remote_user_id>
```

### seed_db.py

Seeds a local Better-Auth admin user and then clones remote user data into the local DB.

**Usage:**
```bash
make -C scripts seed-db
```

**Notes:**
- Requires `REMOTE_DB_URL` and `DATABASE_URL` in the environment
- Prompts for the remote user ID if not provided

### clone_db.py

Full database clone utility.

## Development Scripts

### generate-all.sh

Runs all code generation tools.

**Usage:**
```bash
./scripts/generate-all.sh
```

**What it does:**
- Runs `sqlc generate` (Go database code)
- Runs `make swagger` (API docs)
- Runs `pnpm db:pull` (Frontend Drizzle schema)
- Runs `pnpm generate:api` (Frontend API types)

### test-ci.sh

Runs the full CI test suite locally.

**Usage:**
```bash
./scripts/test-ci.sh
```

**What it does:**
- Backend unit tests
- Backend integration tests
- Frontend linting
- Frontend type checking

## Adding New Scripts

When adding new scripts:

1. **Make them executable:**
   ```bash
   chmod +x scripts/your-script.sh
   ```

2. **Add shebang line:**
   ```bash
   #!/bin/bash
   ```

3. **Add error handling:**
   ```bash
   set -e  # Exit on error
   ```

4. **Document in this README**

5. **Use environment variables for configuration**

6. **Provide helpful error messages**

## Notes

- All scripts assume they're run from the project root directory
- Scripts should be idempotent when possible
- Use `set -e` to fail fast on errors
- Provide usage instructions via `--help` flag
