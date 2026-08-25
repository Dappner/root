import { createFileRoute } from "@tanstack/react-router";

import { SignupPage } from "@/features/auth/pages/signup-page";

export const Route = createFileRoute("/signup")({
  component: SignupRoute,
});

function SignupRoute() {
  const signupEnabled = import.meta.env.VITE_ENABLE_SIGNUP === "true";

  return <SignupPage signupEnabled={signupEnabled} />;
}
