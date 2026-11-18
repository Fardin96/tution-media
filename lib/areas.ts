import { useQuery } from "@tanstack/react-query";
import { client, unwrap } from "./api-client";
import type { Option } from "./profile";
import { queryKeys } from "./query-keys";

/** Areas change rarely, so a mounted list is trusted for five minutes. */
const STALE_MS = 5 * 60_000;

const NO_AREAS: Option[] = [];

/** Public GET /areas: active areas, flattened in division, district, name order, as {id, name} options. */
export const areaApi = {
  list: async (): Promise<Option[]> => {
    const data = await unwrap(client.GET("/api/v1/areas"));
    return data.divisions.flatMap((division) =>
      division.districts.flatMap((district) =>
        district.areas.map(({ id, name }) => ({ id, name })),
      ),
    );
  },
};

let cached: Promise<Option[]> | null = null;

/**
 * One request per page load, shared by searchAreas and useAreas. A failed request is
 * dropped from the cache so the next call tries again.
 */
export function loadAreas(): Promise<Option[]> {
  if (!cached) {
    const request = areaApi.list();
    cached = request;
    request.catch(() => {
      if (cached === request) cached = null;
    });
  }
  return cached;
}

/** Call after an area write so the next read goes to the server. */
export function clearAreaCache(): void {
  cached = null;
}

/** The live area list. `areas` is [] until the first load succeeds. */
export function useAreas() {
  const query = useQuery({
    queryKey: queryKeys.areas,
    queryFn: loadAreas,
    staleTime: STALE_MS,
  });
  return { ...query, areas: query.data ?? NO_AREAS };
}
