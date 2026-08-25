import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/_authenticated/admin")({
  // Replaces the Next server-side admin layout guard (redirect() on a missing
  // session or non-admin role). The parent _authenticated route already gates
  // the session; here we additionally require the admin role.
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data?.session) {
      throw redirect({ to: "/login" });
    }
    if (data.user?.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}
