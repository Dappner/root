"use client";

import { useRouter } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";

interface TakeawayEmptyStateProps {
  sourceId: number;
}

export function TakeawayEmptyState({ sourceId }: TakeawayEmptyStateProps) {
  const router = useRouter();

  return (
    <Empty className="bg-muted/20 py-8">
      <EmptyHeader>
        <EmptyDescription className="max-w-md mx-auto">
          You haven&apos;t distilled this yet. Pick a few quotes and notes, then
          create your first takeaway.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          onClick={() => router.push(routes.sourceTakeawayNew(sourceId))}
        >
          Start a takeaway
        </Button>
      </EmptyContent>
    </Empty>
  );
}
