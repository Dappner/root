#!/usr/bin/env python3
"""
Seed a Better-Auth user so the API client can authenticate.
"""

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urljoin

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
ENV_PATH = ROOT.parent / ".env"
load_dotenv(ENV_PATH)


def set_user_role_to_admin(email: str) -> None:
    """Set the user's role to 'admin' in the database."""
    import psycopg2

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("❌ DATABASE_URL not found in environment")

    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        cursor.execute(
            'UPDATE auth."user" SET role = %s WHERE email = %s', ("admin", email)
        )

        if cursor.rowcount == 0:
            print(f"⚠️  Warning: User {email} not found in database")
        else:
            conn.commit()
            print(f"✓ Set role to 'admin' for user {email}")

        cursor.close()
        conn.close()
    except psycopg2.Error as exc:
        raise SystemExit(f"❌ Database error: {exc}") from exc


def seed_user(
    email: str,
    password: str,
    name: str,
    base_url: str,
) -> None:
    signup_url = urljoin(base_url.rstrip("/") + "/", "api/auth/sign-up/email")
    payload = {"email": email, "password": password, "name": name}
    # Origin must match what auth-server trusts (BETTER_AUTH_URL).
    origin = os.getenv("BETTER_AUTH_URL", "http://localhost:3000")
    headers = {"Origin": origin}

    try:
        response = requests.post(signup_url, json=payload, headers=headers, timeout=10)
    except requests.exceptions.RequestException as exc:
        raise SystemExit(f"Failed to reach Better-Auth at {signup_url}: {exc}") from exc

    if response.status_code == 200:
        print(f"✓ Created Better-Auth user {email}")
        set_user_role_to_admin(email)
        return

    if response.status_code == 422:
        print(f"ℹ️  Better-Auth user {email} already exists.")
        set_user_role_to_admin(email)
        return

    try:
        error_body = response.json()
    except ValueError:
        error_body = response.text

    raise SystemExit(
        f"Failed to seed Better-Auth user (status={response.status_code}): {error_body}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a local Better-Auth user for testing workflows."
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
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not args.email or not args.password:
        print("❌ Email and password are required.", file=sys.stderr)
        sys.exit(1)

    seed_user(args.email, args.password, args.name, args.base_url)


if __name__ == "__main__":
    main()
