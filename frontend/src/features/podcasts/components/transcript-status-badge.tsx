"use client";

import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText, Loader2 } from "lucide-react";

interface TranscriptStatusBadgeProps {
  status: string;
}

export function TranscriptStatusBadge({ status }: TranscriptStatusBadgeProps) {
  switch (status) {
    case 'transcribed':
    case 'embedded':
      return (
        <Badge variant="secondary" className="gap-1 text-[10px] h-5 px-2 bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
          <FileText className="w-3 h-3" />
          Transcript
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="gap-1 text-[10px] h-5 px-2 text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-900/10">
          <Loader2 className="w-3 h-3 animate-spin" />
          Transcribing...
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive" className="gap-1 text-[10px] h-5 px-2">
          <AlertCircle className="w-3 h-3" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}
