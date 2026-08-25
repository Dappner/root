/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Shows the signup UI link ("true"). The auth-server enforces the real gate. */
  readonly VITE_ENABLE_SIGNUP?: string;
  /** Build/release identifier surfaced to the version-check banner. */
  readonly VITE_RELEASE?: string;
  /** Cloudflare Turnstile site key (public). Empty disables CAPTCHA. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** App environment ("local" disables CAPTCHA; "prod" enables prod-only UI). */
  readonly VITE_APP_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
