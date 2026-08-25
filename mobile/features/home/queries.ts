import { useQuery } from "@tanstack/react-query";
import { homeApi } from "./api";
import { homeKeys } from "./query-keys";

export function useHomeData() {
  return useQuery({
    queryKey: homeKeys.data(),
    queryFn: homeApi.getHome,
  });
}
