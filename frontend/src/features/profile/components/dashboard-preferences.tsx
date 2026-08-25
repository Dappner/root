"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { type DashboardMode, useDashboardMode } from "@/features/home/preferences";

const OPTIONS: Array<{
  value: DashboardMode;
  title: string;
  description: string;
}> = [
  {
    value: "zen",
    title: "Zen",
    description: "A calm, focused view with your primary source, suggestions, and unsorted items.",
  },
  {
    value: "analytical",
    title: "Analytical",
    description: "A data-rich overview with stats, trends, and activity across your library.",
  },
];

export function DashboardPreferences() {
  const [mode, setMode] = useDashboardMode();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>
          Choose the style of your home dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Dashboard mode</FieldLabel>
            <RadioGroup value={mode} onValueChange={(value) => setMode(value as DashboardMode)}>
              <div className="grid gap-2">
                {OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`dashboard-mode-${option.value}`}
                    className="flex items-start gap-3 border px-3 py-3 cursor-pointer"
                  >
                    <RadioGroupItem
                      id={`dashboard-mode-${option.value}`}
                      value={option.value}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">{option.title}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
