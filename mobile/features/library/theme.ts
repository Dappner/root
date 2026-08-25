import { SourceDTOStatus } from "@/lib/api/rag-generated";

export const colors = {
  background: "#FAF5EB",
  card: "#FCFCF5",
  foreground: "#2C2C2C",
  muted: "#666050",
  border: "#C9C0A8",
  borderSoft: "#E4DBC5",
  secondary: "#E4DBC5",
  primary: "#3F6B51",
  reflectAccent: "#7B5BB6",
  dot: {
    todo: "#C9A84C",
    in_progress: "#3F6B51",
    reflecting: "#7B5BB6",
    done: "#8A8A8A",
  },
};

export type StatusFilter = "all" | SourceDTOStatus;

export const STATUS_SECTIONS: { key: SourceDTOStatus; label: string; accent: string }[] = [
  { key: SourceDTOStatus.in_progress, label: "In progress", accent: colors.primary },
  { key: SourceDTOStatus.reflecting, label: "Reflecting", accent: colors.reflectAccent },
  { key: SourceDTOStatus.todo, label: "To do", accent: colors.dot.todo },
  { key: SourceDTOStatus.done, label: "Done", accent: colors.dot.done },
];

export const SECTION_PREVIEW_COUNT = 3;
