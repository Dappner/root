"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DEFAULT_GLOBAL_SHORTCUT_LEADER_KEY,
  type CommandPaletteShortcutPreference,
  useCommandPaletteGlobalShortcutMode,
} from "@/features/command-palette/preferences";

const OPTIONS: Array<{
  value: CommandPaletteShortcutPreference;
  title: string;
  description: string | ((leaderKey: string) => string);
}> = [
  {
    value: "disabled",
    title: "Disabled",
    description: "Only Cmd/Ctrl+K opens the command palette.",
  },
  {
    value: "leader",
    title: "Leader key",
    description: (leaderKey) =>
      `Press ${leaderKey}, then a shortcut sequence like g a or c c.`,
  },
];

export function CommandPalettePreferences() {
  const [mode, setMode] = useCommandPaletteGlobalShortcutMode();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Command Palette</CardTitle>
        <CardDescription>
          Choose how global shortcuts should behave outside text fields.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Global shortcut mode</FieldLabel>
            <RadioGroup value={mode} onValueChange={(value) => setMode(value as CommandPaletteShortcutPreference)}>
              <div className="grid gap-2">
                {OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`command-palette-mode-${option.value}`}
                    className="flex items-start gap-3 border px-3 py-3 cursor-pointer"
                  >
                    <RadioGroupItem
                      id={`command-palette-mode-${option.value}`}
                      value={option.value}
                      className="mt-0.5"
                    />
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">{option.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {typeof option.description === "function"
                          ? option.description(DEFAULT_GLOBAL_SHORTCUT_LEADER_KEY)
                          : option.description}
                      </div>
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
