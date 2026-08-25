import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { RefreshControl, type RefreshControlProps } from "react-native";

type QueryKey = readonly unknown[];

const TINT = "#3F6B51";

export function useRefreshControl(
  queryKeys: QueryKey[],
  overrides?: Partial<RefreshControlProps>
) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(
        queryKeys.map((queryKey) => queryClient.refetchQueries({ queryKey }))
      );
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, queryKeys]);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={TINT}
      colors={[TINT]}
      {...overrides}
    />
  );
}
