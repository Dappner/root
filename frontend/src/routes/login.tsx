import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  component: LoginPage,
});

function LoginPage() {
  const signupEnabled = import.meta.env.VITE_ENABLE_SIGNUP === "true";

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden p-0 shadow-xl">
            <CardContent className="grid p-0 md:grid-cols-2">
              <LoginForm signupEnabled={signupEnabled} className="p-6 md:p-8" />
              <div className="bg-muted relative hidden md:block">
                <img
                  src="/root-logo.webp"
                  alt="Root"
                  loading="eager"
                  className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
