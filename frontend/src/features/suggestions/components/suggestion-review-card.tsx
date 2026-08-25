"use client";

import { Link } from "@/lib/nav";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  Mic,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/utils/date";

import { useApproveSuggestion, useDismissSuggestion, useRetrySuggestion } from "../hooks";
import type { SuggestionWithSource } from "../types";
import {
  getRenderShape,
  getSuggestionBody,
  getSuggestionConfidence,
  getSuggestionLabel,
  getSuggestionReasoning,
  isEditableShape,
  updateSuggestionPayloadText,
} from "../utils";

interface SuggestionReviewCardProps {
  suggestion: SuggestionWithSource;
  onAdvance: () => void;
}

export function SuggestionReviewCard({ suggestion, onAdvance }: SuggestionReviewCardProps) {
  const approveSuggestion = useApproveSuggestion();
  const dismissSuggestion = useDismissSuggestion();
  const retrySuggestion = useRetrySuggestion();

  const [isEditing, setIsEditing] = useState(false);
  const [body, setBody] = useState(() => getSuggestionBody(suggestion));

  const shape = getRenderShape(suggestion);
  const confidence = getSuggestionConfidence(suggestion);
  const reasoning = getSuggestionReasoning(suggestion);
  const sourceTitle = suggestion.source?.title ?? `Source ${suggestion.source_id}`;
  const actionLabel = getSuggestionLabel(suggestion, "noun");

  const isReady = suggestion.status === "ready";
  const isFailed = suggestion.status === "failed";
  const isProcessing = suggestion.status === "uploaded" || suggestion.status === "processing";
  const isPending =
    approveSuggestion.isPending ||
    dismissSuggestion.isPending ||
    retrySuggestion.isPending;
  const canEdit = isReady && isEditableShape(shape);

  const handleApprove = async () => {
    try {
      await approveSuggestion.mutateAsync({
        suggestionId: suggestion.id,
        sourceId: suggestion.source_id,
        payload: {
          payload: updateSuggestionPayloadText(suggestion, body),
        },
      });
      toast.success("Saved");
      onAdvance();
    } catch {
      toast.error("Failed to approve");
    }
  };

  const handleDismiss = async () => {
    try {
      await dismissSuggestion.mutateAsync({
        suggestionId: suggestion.id,
        sourceId: suggestion.source_id,
      });
      toast.success("Dismissed");
      onAdvance();
    } catch {
      toast.error("Failed to dismiss");
    }
  };

  const handleRetry = async () => {
    try {
      await retrySuggestion.mutateAsync({
        suggestionId: suggestion.id,
        sourceId: suggestion.source_id,
      });
      toast.success("Queued for retry");
    } catch {
      toast.error("Failed to retry");
    }
  };

  return (
    <div className="rounded-xl border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Mic className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Link
            href={`/library/${suggestion.source_id}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {sourceTitle}
          </Link>
          <span className="text-xs text-muted-foreground">{timeAgo(suggestion.created_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{actionLabel}</Badge>
          {confidence != null && (
            <span className="text-xs text-muted-foreground">{confidence}% confidence</span>
          )}
        </div>
      </div>

      <div className="space-y-0 divide-y">
        {/* Voice transcript — what you said */}
        {suggestion.voice_transcript && (
          <div className="px-5 py-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              You said
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground italic">
              &ldquo;{suggestion.voice_transcript}&rdquo;
            </p>
          </div>
        )}

        {/* AI interpretation — what it extracted */}
        <div className="px-5 py-4">
          {isFailed ? (
            <FailedView reasoning={reasoning} />
          ) : isProcessing ? (
            <ProcessingView />
          ) : (
            <>
              <EntityView
                shape={shape}
                isEditing={isEditing}
                body={body}
                onBodyChange={setBody}
              />
              {reasoning && !isEditing && shape.kind !== "no-payload" && (
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  {reasoning}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
        <div>
          {isFailed && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={handleRetry}
            >
              {retrySuggestion.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Retry
            </Button>
          )}
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setIsEditing((v) => !v)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {isEditing ? "Preview" : "Edit"}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending || isProcessing}
            onClick={handleDismiss}
          >
            {dismissSuggestion.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            Dismiss
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPending || !isReady || !body.trim()}
            onClick={handleApprove}
          >
            {approveSuggestion.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────

function FailedView({ reasoning }: { reasoning: string | null }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-destructive">
        Processing failed
      </p>
      {reasoning && <p className="text-sm text-muted-foreground">{reasoning}</p>}
    </div>
  );
}

function ProcessingView() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Processing…
    </div>
  );
}

interface EntityViewProps {
  shape: ReturnType<typeof getRenderShape>;
  isEditing: boolean;
  body: string;
  onBodyChange: (next: string) => void;
}

function EntityView({ shape, isEditing, body, onBodyChange }: EntityViewProps) {
  switch (shape.kind) {
    case "no-payload":
      return null;
    case "uncertain":
      return (
        <p className="text-sm text-muted-foreground">
          The AI couldn&apos;t determine what to create from this recording.
        </p>
      );
    case "single-citation":
      return (
        <div className="space-y-1.5">
          <Label>Quote to save</Label>
          {isEditing ? (
            <Textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              className="min-h-24 text-sm"
            />
          ) : (
            <Quote>{shape.citation.text}</Quote>
          )}
        </div>
      );
    case "single-capture":
      return (
        <div className="space-y-1.5">
          <Label>Comment to save</Label>
          {isEditing ? (
            <Textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              className="min-h-20 text-sm"
            />
          ) : (
            <p className="text-sm leading-relaxed">{shape.capture.text}</p>
          )}
        </div>
      );
    case "citation-with-capture": {
      const [head, ...tail] = body.split(/\n\s*\n/);
      const citationText = head ?? body;
      const captureText = tail.join("\n\n");
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Quote</Label>
            {isEditing ? (
              <Textarea
                value={citationText}
                onChange={(e) =>
                  onBodyChange([e.target.value, captureText].join("\n\n"))
                }
                className="min-h-24 text-sm"
              />
            ) : (
              <Quote>{shape.citation.text}</Quote>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Your comment</Label>
            {isEditing ? (
              <Textarea
                value={captureText}
                onChange={(e) =>
                  onBodyChange([citationText, e.target.value].join("\n\n"))
                }
                className="min-h-20 text-sm"
              />
            ) : (
              <p className="text-sm leading-relaxed">{shape.capture.text}</p>
            )}
          </div>
        </div>
      );
    }
    case "multi":
      return (
        <div className="space-y-4">
          {shape.citations.map((c, i) => (
            <div key={`c-${i}`} className="space-y-1.5">
              <Label>Quote {shape.citations.length > 1 ? i + 1 : ""}</Label>
              <Quote>{c.text}</Quote>
            </div>
          ))}
          {shape.captures.map((cap, i) => (
            <div key={`cap-${i}`} className="space-y-1.5">
              <Label>
                Comment {shape.captures.length > 1 ? i + 1 : ""}
                {cap.citation_idx != null
                  ? ` · on quote ${cap.citation_idx + 1}`
                  : ""}
              </Label>
              <p className="text-sm leading-relaxed">{cap.text}</p>
            </div>
          ))}
        </div>
      );
  }
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="border-l-2 border-border pl-3 text-sm leading-relaxed">
      {children}
    </blockquote>
  );
}
