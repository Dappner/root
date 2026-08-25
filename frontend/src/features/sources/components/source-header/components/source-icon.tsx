import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import { getSourceIcon } from "@/features/sources/utils/source-type-meta";

interface SourceIconProps {
  type: string;
  className?: string;
}

export function SourceIcon({ type, className }: SourceIconProps) {
  const icon: LucideIcon = getSourceIcon(type);

  return createElement(icon, { className });
}
