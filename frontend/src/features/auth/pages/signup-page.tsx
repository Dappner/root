"use client";

import { useEffect } from "react";

import { SignupForm } from "@/features/auth/components/signup-form";
import { useRouter } from "@/lib/nav";
import { routes } from "@/lib/routes";

interface SignupPageProps {
  signupEnabled: boolean;
}

export function SignupPage({ signupEnabled }: SignupPageProps) {
  const router = useRouter();

  useEffect(() => {
    if (!signupEnabled) {
      router.replace(routes.login);
    }
  }, [signupEnabled, router]);

  if (!signupEnabled) {
    return null;
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <SignupForm />
      </div>
    </div>
  );
}
