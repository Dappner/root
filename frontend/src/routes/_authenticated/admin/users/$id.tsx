import { createFileRoute } from "@tanstack/react-router";

import { AdminUserDetailPage } from "@/features/admin/pages/admin-user-detail-page";

export const Route = createFileRoute("/_authenticated/admin/users/$id")({
  component: AdminUserDetailRoute,
});

function AdminUserDetailRoute() {
  // Auth user ids are opaque strings — keep as-is, do not coerce to number.
  const { id } = Route.useParams();

  return <AdminUserDetailPage id={id} />;
}
