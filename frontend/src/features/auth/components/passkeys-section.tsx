"use client";

import { Button } from "@/components/ui/button";
import { passkey, useListPasskeys } from "@/lib/auth/client";
import { Fingerprint, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function PasskeysSection() {
  const { data: passkeys, isPending, refetch } = useListPasskeys();
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    setAdding(true);
    try {
      const { error } = await passkey.addPasskey();
      if (error) {
        // A cancelled WebAuthn prompt surfaces here too — keep it quiet-ish.
        toast.error(error.message || "Could not add passkey");
        return;
      }
      toast.success("Passkey added");
      void refetch();
    } catch {
      // Thrown when the user dismisses the native prompt.
      toast.error("Passkey registration was cancelled");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const { error } = await passkey.deletePasskey({ id });
      if (error) {
        toast.error(error.message || "Could not remove passkey");
        return;
      }
      toast.success("Passkey removed");
      void refetch();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Passkeys</p>
          <p className="text-sm text-muted-foreground">
            Sign in with Touch ID, Windows Hello, or a security key
          </p>
        </div>
        <Button variant="outline" onClick={handleAdd} disabled={adding}>
          {adding ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Fingerprint className="size-4" />
          )}
          Add passkey
        </Button>
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading passkeys…</p>
      ) : !passkeys?.length ? (
        <p className="text-sm text-muted-foreground">
          No passkeys yet. Add one to enable passwordless sign-in.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {passkeys.map((pk) => (
            <li
              key={pk.id}
              className="flex items-center justify-between px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Fingerprint className="size-4 text-muted-foreground" />
                <span className="text-sm">
                  {pk.name || "Passkey"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove passkey"
                onClick={() => handleDelete(pk.id)}
                disabled={deletingId === pk.id}
              >
                {deletingId === pk.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4 text-destructive" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
