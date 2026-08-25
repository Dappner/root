"use client";

import { useCallback, useImperativeHandle, useRef, forwardRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

// Captcha is enabled when a site key is provided and we're not in the local env.
// VITE_* vars are inlined at BUILD TIME by Vite, so they must be passed as build
// args (see Dockerfile / DEPLOY.md), not just runtime env.
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const appEnv = import.meta.env.VITE_APP_ENV || import.meta.env.MODE || "development";
const isLocal = appEnv === "local";
const isCaptchaEnabled = !isLocal && !!siteKey;

// Debug logging (only in production to help diagnose deployment issues)
if (typeof window !== "undefined" && import.meta.env.PROD) {
  if (!isCaptchaEnabled) {
    console.error("[CaptchaWidget] CAPTCHA is DISABLED:", {
      siteKey: siteKey ? `${siteKey.substring(0, 10)}...` : "NOT SET",
      appEnv,
      isLocal,
      mode: import.meta.env.MODE,
      reason: !siteKey
        ? "VITE_TURNSTILE_SITE_KEY is not set"
        : isLocal
          ? `VITE_APP_ENV is set to "local" (disable captcha)`
          : "Unknown reason",
    });
  } else {
    console.log("[CaptchaWidget] CAPTCHA is ENABLED:", {
      appEnv,
      mode: import.meta.env.MODE,
      siteKeyPrefix: siteKey?.substring(0, 10) + "...",
    });
  }
}

interface CaptchaWidgetProps {
  onVerify: (token: string) => void;
  onError?: (error: unknown) => void;
  onExpire?: () => void;
  className?: string;
}

export interface CaptchaWidgetRef {
  reset: () => void;
}

/**
 * Conditional Captcha Widget component that only renders in production.
 * In development, this component returns null and no captcha is shown.
 */
export const CaptchaWidget = forwardRef<CaptchaWidgetRef, CaptchaWidgetProps>(
  ({ onVerify, onError, onExpire, className }, ref) => {
    // All hooks must be called in the same order every render to avoid "Rendered more hooks" error
    // Move conditional return AFTER all hooks
    const turnstileRef = useRef<TurnstileInstance | null>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        turnstileRef.current?.reset();
      },
    }));

    const handleVerify = useCallback(
      (token: string) => {
        onVerify(token);
      },
      [onVerify]
    );

    const handleError = useCallback(
      (error: unknown) => {
        onError?.(error);
      },
      [onError]
    );

    const handleExpire = useCallback(() => {
      onExpire?.();
    }, [onExpire]);

    // Don't render captcha if site key is not provided or in local environment
    // IMPORTANT: This check is AFTER all hooks to maintain consistent hook order
    if (!isCaptchaEnabled) {
      // Warn in development if CAPTCHA is expected but not configured
      if (import.meta.env.DEV && !isLocal && !siteKey) {
        console.warn(
          "[CaptchaWidget] CAPTCHA is disabled: VITE_TURNSTILE_SITE_KEY is not set. " +
          "If TURNSTILE_SECRET_KEY is set on the backend, CAPTCHA will be required but will fail."
        );
      }
      // In production, show a visible error message if captcha is required but not configured
      // This helps diagnose deployment issues
      if (import.meta.env.PROD && !siteKey) {
        return (
          <div className={className}>
            <div className="rounded-md border border-red-500 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              <strong>CAPTCHA Error:</strong> VITE_TURNSTILE_SITE_KEY is not configured.
              Please check your deployment environment variables.
            </div>
          </div>
        );
      }
      return null;
    }

    return (
      <div className={className}>
        <Turnstile
          siteKey={siteKey}
          onSuccess={handleVerify}
          onError={handleError}
          onExpire={handleExpire}
          ref={turnstileRef}
        />
      </div>
    );
  }
);

CaptchaWidget.displayName = "CaptchaWidget";
