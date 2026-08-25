#!/usr/bin/env python3
"""Seed a Better-Auth admin user, then clone remote data into the local DB."""

import argparse
import asyncio
import os
import sys
from typing import Optional

from clone_user_data import clone_user_data
from seed_better_auth_user import seed_user


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed a local admin user and clone remote user data."
    )
    parser.add_argument(
        "--email",
        default=os.getenv("ADMIN_EMAIL", "admin@example.com"),
        help="Email for the seeded user (default: ADMIN_EMAIL or admin@example.com)",
    )
    parser.add_argument(
        "--password",
        default=os.getenv("ADMIN_PASSWORD", "password"),
        help="Password for the seeded user (default: ADMIN_PASSWORD or 'password')",
    )
    parser.add_argument(
        "--name",
        default=os.getenv("ADMIN_NAME", "Root Admin"),
        help="Display name for the seeded user (default: ADMIN_NAME or 'Root Admin')",
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("API_URL", "http://localhost:8000"),
        help="Auth ingress to POST to — nginx (API_URL, default http://localhost:8000).",
    )
    parser.add_argument("--remote-user-id", help="User ID in remote database")
    parser.add_argument("--local-user-id", help="User ID in local database")
    parser.add_argument(
        "--use-local-admin",
        action="store_true",
        default=True,
        help="Use local user with email admin@example.com (default: true)",
    )
    parser.add_argument(
        "--no-use-local-admin",
        action="store_false",
        dest="use_local_admin",
        help="Use explicit local user ID instead of admin@example.com",
    )
    parser.add_argument(
        "--local-admin-email",
        default="admin@example.com",
        help="Email to use with --use-local-admin (default: admin@example.com)",
    )
    return parser.parse_args()


def load_env_urls() -> tuple[str, str]:
    remote_url = os.getenv("REMOTE_DB_URL", "").strip().strip("'").strip('"')
    local_url = os.getenv("DATABASE_URL", "").strip().strip("'").strip('"')

    if not remote_url or not local_url:
        raise SystemExit("Error: REMOTE_DB_URL or DATABASE_URL not set")

    return remote_url, local_url


def main() -> None:
    args = parse_args()

    if not args.email or not args.password:
        print("❌ Email and password are required.", file=sys.stderr)
        sys.exit(1)

    remote_user_id = args.remote_user_id or input("Remote user ID: ").strip()
    if not remote_user_id:
        print("Error: Remote user ID is required", file=sys.stderr)
        sys.exit(1)

    seed_user(args.email, args.password, args.name, args.base_url)

    local_user_id: Optional[str] = args.local_user_id

    if not args.use_local_admin and not local_user_id:
        local_user_id = input("Local user ID: ").strip()

    if not args.use_local_admin and not local_user_id:
        print(
            "Error: Local user ID is required (or pass --use-local-admin)",
            file=sys.stderr,
        )
        sys.exit(1)

    remote_url, local_url = load_env_urls()

    asyncio.run(
        clone_user_data(
            remote_url,
            local_url,
            remote_user_id,
            local_user_id,
            use_local_admin=args.use_local_admin,
            local_admin_email=args.local_admin_email,
        )
    )


if __name__ == "__main__":
    main()
