import { createFileRoute } from "@tanstack/react-router";

import { ProfilePage } from "@/features/profile/pages/profile-page";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});
