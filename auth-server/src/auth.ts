import { db } from "./db/client";
import * as schema from "./db/schema";
import { sendPasswordResetEmail } from "./email";
import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, captcha, jwt } from "better-auth/plugins";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET is not set — refusing to start");
}

const signupEnabled = process.env.ENABLE_SIGNUP === "true";
const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
const isLocal = appEnv === "local";

const plugins = [
  jwt(),
  expo(),
  admin(),
  passkey(),
  ...(!isLocal && process.env.TURNSTILE_SECRET_KEY
    ? [
        captcha({
          provider: "cloudflare-turnstile",
          secretKey: process.env.TURNSTILE_SECRET_KEY,
          endpoints: ["/sign-up/email", "/request-password-reset"],
        }),
      ]
    : []),
];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.userInAuth,
      session: schema.sessionInAuth,
      account: schema.accountInAuth,
      verification: schema.verificationInAuth,
      jwks: schema.jwksInAuth,
      passkey: schema.passkeyInAuth,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: !signupEnabled,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl: url,
        userName: user.name,
      });
    },
  },
  plugins,
  trustedOrigins: [
    "rootmobile://",
    ...(process.env.NODE_ENV === "development"
      ? ["exp://", "exp://**", "exp://192.168.*.*:*/**"]
      : []),
  ],
  secret,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
});
