#!/usr/bin/env python3
"""Clone remote database to local database."""

import os
import subprocess
import sys
from pathlib import Path
from dotenv import load_dotenv


ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)


def main():
    remote_url = os.getenv("REMOTE_DB_URL", "").strip().strip("'").strip('"')
    local_url = os.getenv("DATABASE_URL", "").strip().strip("'").strip('"')

    if not remote_url or not local_url:
        print("Error: REMOTE_DB_URL or DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    print("🔄 Cloning database...")

    # Dump remote (plain SQL) and pipe to psql
    print("📦 Dumping and restoring...")
    dump = subprocess.Popen(
        [
            "docker",
            "run",
            "--rm",
            "-i",
            "postgres:17",
            "pg_dump",
            "--clean",
            "--if-exists",
            "--no-owner",
            remote_url,
        ],
        stdout=subprocess.PIPE,
    )

    subprocess.run(
        ["psql", local_url],
        stdin=dump.stdout,
        check=True,
    )

    dump.wait()
    print("✅ Done!")


if __name__ == "__main__":
    main()
