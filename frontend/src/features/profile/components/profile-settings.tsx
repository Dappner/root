import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangePasswordDialog } from "@/features/auth/components/change-password-dialog";
import { PasskeysSection } from "@/features/auth/components/passkeys-section";
import { CommandPalettePreferences } from "@/features/profile/components/command-palette-preferences";
import { DashboardPreferences } from "@/features/profile/components/dashboard-preferences";
import { UpdateProfileForm } from "@/features/profile/components/update-profile-form";
import type { User } from "@/lib/auth/user-provider";

interface ProfileSettingsProps {
  user: User;
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <UpdateProfileForm user={user} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Manage your password and security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Password</p>
              <p className="text-sm text-muted-foreground">••••••••</p>
            </div>
            <ChangePasswordDialog />
          </div>
          <PasskeysSection />
        </CardContent>
      </Card>

      <CommandPalettePreferences />

      <DashboardPreferences />
    </div>
  );
}
