"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PatternsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patterns</CardTitle>
        <CardDescription>
          Cross-source themes and recurring ideas from your captures and
          takeaways will show up here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground py-8 text-center">
          Coming soon.
        </p>
      </CardContent>
    </Card>
  );
}
