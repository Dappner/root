"use client";

import { useDialog } from "@/components/dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { CreateUserDialog } from "@/features/admin/dialogs/create-user-dialog";
import { useUsers } from "@/features/admin/hooks/users";
import { formatDateUTC } from "@/lib/utils";
import { Loader2, Shield, User as UserIcon, UserPlus } from "lucide-react";
import { Link } from "@/lib/nav";

export function AdminUsersPage() {
  const { openDialog } = useDialog();
  const { data, isLoading, error } = useUsers();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Empty className="py-12 rounded-xl">
        <EmptyHeader>
          <EmptyDescription className="text-destructive">
            {error instanceof Error ? error.message : "Failed to load users"}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const users = data?.users ?? [];

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Users" },
            ]}
          />
        }
      />
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Manage Users</h1>
            <Button onClick={() => openDialog(CreateUserDialog)} size="lg">
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </div>

          <div className="space-y-4">
            {users.map((user) => (
              <Link key={user.id} href={`/admin/users/${user.id}`}>
                <div className="group py-4 border-b last:border-b-0 hover:bg-accent/5 -mx-4 px-4 rounded-lg transition-all">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary/50 group-hover:bg-secondary transition-colors">
                      <UserIcon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors">
                              {user.name}
                            </h3>
                            {user.role === "admin" && (
                              <Badge variant="default" className="gap-1">
                                <Shield className="h-3 w-3" />
                                Admin
                              </Badge>
                            )}
                            {user.banned && (
                              <Badge variant="destructive">Banned</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>Email Verified: {user.emailVerified ? "Yes" : "No"}</span>
                        <span>•</span>
                        <span className="capitalize">Role: {user.role || "user"}</span>
                        <span>•</span>
                        <span>Created: {formatDateUTC(user.createdAt)}</span>
                      </div>

                      {user.banned && user.banReason && (
                        <div className="mt-2 rounded-lg bg-destructive/10 p-3">
                          <p className="text-xs font-medium text-destructive">
                            Ban Reason: {user.banReason}
                          </p>
                          {user.banExpires && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Expires: {formatDateUTC(user.banExpires)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {users.length === 0 && (
            <Empty className="py-12 rounded-xl">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UserIcon className="size-5" />
                </EmptyMedia>
                <EmptyDescription>No users found</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>
    </>
  );
}
