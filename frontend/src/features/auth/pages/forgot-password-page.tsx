"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CaptchaWidget, type CaptchaWidgetRef } from "@/components/captcha-widget";
import { requestPasswordReset } from "@/lib/auth/client";
import { Link } from "@/lib/nav";
import { routes } from "@/lib/routes";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaWidgetRef>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await requestPasswordReset({
        email,
        redirectTo: "/reset-password",
        fetchOptions: {
          headers: {
            ...(captchaToken && { "x-captcha-response": captchaToken }),
          },
        },
      });

      if (result.error) {
        setError(result.error.message || "Failed to send reset email");
        // Reset captcha on error to allow retry
        captchaRef.current?.reset();
        setCaptchaToken(null);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("An error occurred. Please try again.");
      // Reset captcha on error to allow retry
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-4" />
              <h1 className="text-2xl font-bold mb-2">Check your email</h1>
              <p className="text-muted-foreground mb-6">
                We&apos;ve sent a password reset link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                The link will expire in 1 hour. If you don&apos;t see the email,
                check your spam folder.
              </p>
              <Button variant="outline" className="w-full" nativeButton={false} render={
                <Link href={routes.login}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to login
                </Link>
              }>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <div className="flex flex-col gap-2 text-center mb-6">
                  <h1 className="text-2xl font-bold">Forgot password?</h1>
                  <p className="text-muted-foreground text-balance">
                    Enter your email address and we&apos;ll send you a link to reset
                    your password.
                  </p>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                    {error}
                  </div>
                )}
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <CaptchaWidget
                    ref={captchaRef}
                    onVerify={setCaptchaToken}
                    onExpire={() => setCaptchaToken(null)}
                    className="flex justify-center"
                  />
                </Field>
                <Field>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Sending..." : "Send reset link"}
                  </Button>
                </Field>
                <FieldDescription className="text-center">
                  Remember your password?{" "}
                  <Link href={routes.login} className="underline">
                    Back to login
                  </Link>
                </FieldDescription>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
