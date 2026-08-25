# Authentication overview

- **Provider:** Next.js hosts Better Auth at `/api/auth/[...all]` using `better-auth` backed by the `auth` Postgres schema (see migrations `000001_create_auth_schema.up.sql`). Sign-up is controlled via `ENABLE_SIGNUP`; with the current invite-only mode, Better Auth rejects new sign-ups unless `ENABLE_SIGNUP=true` at build time.
- **Session format:** Better Auth issues a JWT stored in the HTTP-only `root_session` cookie (or sent as a `Bearer` token). The JWT is also exposed via the Better Auth JWT plugin and advertised through JWKS at `/api/auth/jwks`.
- **Backend validation:** The Go API constructs a JWKS validator pointed at `${FRONTEND_URL}/api/auth/jwks` (`JWTIssuer` in `internal/service/jwt_issuer.go`). The `RequireAuth` middleware accepts the `Authorization` header or the `root_session` cookie, validates via JWKS, and injects claims into the request context.
- **Routing:** All `/go-api/**` routes in Go are protected by `RequireAuth`; there are no auth endpoints in the Go service itself. Auth flows (sign up, sign in, password reset) are served entirely by the Next.js Better Auth handler.
- **Email reset:** Password reset emails are sent through Resend from `frontend/src/lib/email.ts` when Better Auth invokes `sendResetPassword`.
- **Config to verify:** Ensure `FRONTEND_URL` in the Go service matches the Next.js origin (so JWKS fetch succeeds) and `BETTER_AUTH_URL`/`BETTER_AUTH_SECRET` are set in the frontend env. The default cookie name expected by Go is `root_session`.
