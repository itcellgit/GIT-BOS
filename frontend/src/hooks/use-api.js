import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getData } from "@/lib/api";

/** Loads `/api{path}`. The path is also the cache key, so refreshing after a change is simple. */
export function useApiQuery(path, options = {}) {
  return useQuery({ queryKey: [path], queryFn: () => getData(path), ...options });
}

/** The signed-in user (or null). */
export function useMe() {
  return useApiQuery("/me", { staleTime: 30_000 });
}

/** After a successful change: reload everything on screen (the data is small). */
export function useRefreshAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}
