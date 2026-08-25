"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { Fingerprint } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CaptchaWidget, type CaptchaWidgetRef } from "@/components/captcha-widget";
import { signIn } from "@/lib/auth/client";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Link, useRouter } from "@/lib/nav";

const LoginFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof LoginFormSchema>;

export function LoginForm({
  className,
  signupEnabled = true,
  ...props
}: React.ComponentProps<"form"> & { signupEnabled?: boolean }) {
  const router = useRouter();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaWidgetRef>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Conditional UI: preload passkeys so the browser can offer them in the
  // email field's autofill. This is a passive background hint — it must NEVER
  // surface an error toast (the user didn't ask for anything). It silently does
  // nothing when there are no passkeys, the browser lacks support, or the user
  // ignores the autofill prompt.
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.PublicKeyCredential?.isConditionalMediationAvailable
    ) {
      return;
    }
    let cancelled = false;
    window.PublicKeyCredential.isConditionalMediationAvailable()
      .then((available) => {
        if (available && !cancelled) {
          // Swallow all outcomes — conditional UI is best-effort.
          void signIn.passkey({ autoFill: true })?.catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Explicit user action — this one DOES report failure.
  async function onPasskeySignIn() {
    try {
      const result = await signIn.passkey();
      if (result?.error) {
        toast.error(result.error.message || "Passkey sign-in failed");
        return;
      }
      router.push(routes.root);
    } catch {
      toast.error("Passkey sign-in was cancelled");
    }
  }

  async function onSubmit(data: LoginFormData) {
    try {
      const result = await signIn.email({
        email: data.email,
        password: data.password,
        fetchOptions: {
          headers: {
            ...(captchaToken && { "x-captcha-response": captchaToken }),
          },
        },
      });

      if (result.error) {
        toast.error(result.error.message || "Invalid credentials");
        // Reset captcha on error to allow retry
        captchaRef.current?.reset();
        setCaptchaToken(null);
      } else {
        router.push(routes.root);
      }
    } catch {
      toast.error("An error occurred during login");
      // Reset captcha on error to allow retry
      captchaRef.current?.reset();
      setCaptchaToken(null);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    form.handleSubmit(onSubmit)(e);
  };

  return (
    <form
      id="login-form"
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground text-balance">
            Login to your Root account
          </p>
        </div>

        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                placeholder="m@example.com"
                aria-invalid={fieldState.invalid}
                autoComplete="email webauthn"
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Link
                  href={routes.forgotPassword}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                {...field}
                id="password"
                type="password"
                aria-invalid={fieldState.invalid}
                autoComplete="current-password"
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        <Field>
          <CaptchaWidget
            ref={captchaRef}
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
            className="flex justify-center"
          />
        </Field>

        <Field>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            form="login-form"
          >
            {form.formState.isSubmitting ? "Signing in..." : "Login"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onPasskeySignIn}
            disabled={form.formState.isSubmitting}
          >
            <Fingerprint className="size-4" />
            Sign in with a passkey
          </Button>
        </Field>

        {signupEnabled && (
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <Link href={routes.signup} className="underline">
              Sign up
            </Link>
          </FieldDescription>
        )}
      </FieldGroup>
    </form>
  );
}
