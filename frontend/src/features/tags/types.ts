import type {
  CreateTagRequest as GeneratedCreateTagRequest,
  TagDTO as GeneratedTagDTO,
  UpdateTagRequest as GeneratedUpdateTagRequest,
} from "@/features/rag/rag-api.generated";

// Pydantic marks these as required; refine the orval-generated optionals.
export interface TagDTO
  extends Omit<
    GeneratedTagDTO,
    "id" | "user_id" | "slug" | "label" | "created_at" | "updated_at"
  > {
  id: number;
  user_id: string;
  slug: string;
  label: string;
  created_at: string;
  updated_at: string;
  color?: string;
}

export type CreateTagRequest = GeneratedCreateTagRequest;
export type UpdateTagRequest = GeneratedUpdateTagRequest;
