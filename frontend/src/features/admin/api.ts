import {
  getStaleEmbeddingsCountRagApiAdminEmbeddingsStaleCountGet,
  getTranscriptEpisodes,
  processStaleEmbeddingsRagApiAdminEmbeddingsProcessPost,
} from "@/features/rag/rag-api.generated";
import { authClient } from "@/lib/auth/client";
import type { User, UsersListResponse } from "./types";

export const usersApi = {
  /**
   * Get all users via the Better-Auth admin plugin (auth-server enforces the
   * admin role; the admin route's beforeLoad also gates the UI).
   */
  getUsers: async (): Promise<UsersListResponse> => {
    const { data, error } = await authClient.admin.listUsers({
      query: { limit: 100, sortBy: "createdAt", sortDirection: "desc" },
    });
    if (error) {
      throw new Error(error.message ?? "Failed to fetch users");
    }
    return {
      users: (data?.users ?? []) as User[],
      total: data?.total ?? 0,
    };
  },

  /**
   * Get user by ID
   * Fetches from list and filters by ID (Better-Auth doesn't have a single user endpoint)
   */
  getUser: async (id: string): Promise<User | null> => {
    const data = await usersApi.getUsers();
    return data.users.find((user) => user.id === id) || null;
  },

  /**
   * Create a user via the Better-Auth admin plugin with a random temporary
   * password, then send a password-reset email so they set their own. Mirrors
   * the retired /api/admin/create-user handler.
   */
  createUser: async (input: { email: string; name: string }): Promise<void> => {
    // Random temp password (Web Crypto; the user never uses it — they reset).
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const tempPassword = Array.from(bytes, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");

    const { error } = await authClient.admin.createUser({
      email: input.email,
      name: input.name,
      password: tempPassword,
      role: "user",
    });
    if (error) {
      const message = error.message ?? "";
      if (/unique|duplicate|exist/i.test(message)) {
        throw new Error("User with this email already exists");
      }
      throw new Error(message || "Failed to create user");
    }

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error: resetError } = await authClient.requestPasswordReset({
      email: input.email,
      redirectTo: `${origin}/reset-password`,
    });
    if (resetError) {
      throw new Error(
        resetError.message ?? "User created, but password reset email failed",
      );
    }
  },
};
export const transcriptsApi = {
  /**
   * List podcast episodes with a finished transcript, ready to embed
   */
  getEpisodes: async () => {
    const response = await getTranscriptEpisodes();
    if (response.status !== 200) {
      throw new Error(
        `Failed to fetch transcript episodes: ${response.status}`,
      );
    }
    return response.data;
  },
};

export const embeddingsApi = {
  getStaleCount: async (userId: string) => {
    const response =
      await getStaleEmbeddingsCountRagApiAdminEmbeddingsStaleCountGet({
        user_id: userId,
      });
    if (response.status !== 200) {
      throw new Error(
        `Failed to fetch stale embeddings count: ${response.status}`,
      );
    }
    return response.data;
  },

  processStale: async (userId: string, limit: number = 200) => {
    const response =
      await processStaleEmbeddingsRagApiAdminEmbeddingsProcessPost({
        user_id: userId,
        limit,
      });
    if (response.status !== 200) {
      throw new Error(`Failed to process stale embeddings: ${response.status}`);
    }
    return response.data;
  },
};
