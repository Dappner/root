"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "../api";
import { adminKeys } from "../keys";
import type { UsersListResponse } from "../types";

/**
 * Fetch all users from Better-Auth
 */
export function useUsers() {
  return useQuery({
    queryKey: adminKeys.usersList(),
    queryFn: usersApi.getUsers,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Fetch single user by ID
 * Seeds from users list cache if available
 */
export function useUser(id: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: adminKeys.user(id),
    queryFn: () => usersApi.getUser(id),
    enabled: !!id,
    placeholderData: () => {
      // Try to seed from list cache
      const cached = queryClient.getQueryData<UsersListResponse>(
        adminKeys.usersList(),
      );
      return cached?.users?.find((user) => user.id === id);
    },
    staleTime: 30_000, // 30 seconds
  });
}
