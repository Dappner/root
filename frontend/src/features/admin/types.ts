// User type from Better-Auth
export type { User } from "@/lib/auth/user-provider";
import type { User } from "@/lib/auth/user-provider";

export type { TranscriptEpisode } from "@/features/rag/rag-api.generated";

/**
 * Response from Better-Auth user list endpoint
 */
export interface UsersListResponse {
  users: User[];
  total: number;
}
