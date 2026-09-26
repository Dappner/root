# Auth & admin

Email/password auth runs through Better-Auth in auth-server. FastAPI validates the JWT from the auth-server's JWKS endpoint. Admins get an Admin section for user management.

## Sub-features

- `/login` (`input#email`, `input#password`, submit), `/signup`, `/forgot-password`, `/reset-password`.
- Session cookie, plus a JWT from `GET /api/auth/token` that is sent to `/rag-api/*`.
- Admin (role `admin` only):
  - `/admin` overview
  - `/admin/users` (`Manage Users`, `Create User`, user cards)
  - `/admin/users/$id`

## How to get to it (user POV)

Logged out: any route redirects to `/login`. Logged in as an admin: the sidebar shows an **Admin** group with **Overview** and **Users**.

## Driving it with Playwright

- **Login:** every scenario already logs in through `/login` (`harness/lib.mjs`). Waiting for the URL to leave `/login` proves it worked.
- **Admin:** go to `/admin/users` and check that `heading "Manage Users"` and a card link containing `verify@example.com` and `Role: admin` are visible.
- **Signup:** run a session with `login: false` (`session({ login: false })` in `lib.mjs`), go to `/signup`, and use a fresh email.

**Proof for signup:**

```sql
select email, role from auth."user" where email = '<new email>'
```

## Gotchas

- Turnstile captcha is off locally: auth-server only enables it when `APP_ENV != local` and a secret is set.
- Email (Resend) isn't configured, so forgot-password and reset-password can't deliver mail. They count as `verified-unreachable` until an email sink is added.
- The seeded user becomes admin through a direct `update auth."user"` in `up.sh`. That is a precondition, not something under test.
