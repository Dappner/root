import { Calendar, Quote } from "lucide-react";
import { Link } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import type { TakeawayOfDay } from "@/features/stats/types";
import type { User } from "@/lib/auth/user-provider";

interface ProfileHeroProps {
  user: User;
  tagline?: string;
  takeaway?: TakeawayOfDay | null;
}

function getInitials(user: User) {
  if (user.name) {
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return user.email[0].toUpperCase();
}

function daysOnRoot(createdAt: User["createdAt"]) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;
  const diff = Date.now() - created;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function ProfileHero({ user, tagline, takeaway }: ProfileHeroProps) {
  const initials = getInitials(user);
  const joined = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const days = daysOnRoot(user.createdAt);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 lg:gap-12 items-start">
      <div className="flex items-start gap-6 min-w-0">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-700/30 text-emerald-100 text-2xl font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0 space-y-2">
          <h1 className="text-4xl font-bold tracking-tight truncate">
            {user.name || "User"}
          </h1>
          {tagline && (
            <p className="text-sm text-muted-foreground">{tagline}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Joined {joined}
            </span>
            {days !== null && (
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-normal"
              >
                {days} days on Root
              </Badge>
            )}
          </div>
        </div>
      </div>

      {takeaway && (
        <div className="flex gap-2.5 max-w-md text-sm text-muted-foreground lg:pl-6 lg:border-l lg:border-border/60">
          <Quote className="h-4 w-4 text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Takeaway of the day
            </p>
            <p className="font-medium text-foreground leading-snug line-clamp-2">
              {takeaway.title}
            </p>
            {takeaway.source_title && (
              <p className="text-xs">
                — from{" "}
                <Link
                  href={`/library/${takeaway.source_id}`}
                  className="hover:text-foreground underline-offset-2 hover:underline"
                >
                  {takeaway.source_title}
                </Link>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
