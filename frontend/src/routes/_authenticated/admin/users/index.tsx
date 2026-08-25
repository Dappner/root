import { createFileRoute } from "@tanstack/react-router";

import { AdminUsersPage } from "@/features/admin/pages/admin-users-page";

export const Route = createFileRoute("/_authenticated/admin/users/")({
  component: AdminUsersPage,
});
