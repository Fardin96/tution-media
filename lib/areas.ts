import { useQuery } from "@tanstack/react-query";
import { client, unwrap } from "./api-client";
import type { Option } from "./profile";
import { queryKeys } from "./query-keys";

/** Areas change rarely, so a list is trusted for 30 minutes; admin edits invalidate it. */
const STALE_MS = 30 * 60_000;
const GC_MS = 60 * 60_000;

/** An area option with its district's name, so a picker can tell "Sadar" in one district from another. */
export interface AreaOption extends Option {
  district: string;
}

const NO_AREAS: AreaOption[] = [];

/** Public GET /areas: active areas, flattened in division, district, name order. */
export const areaApi = {
  list: async (): Promise<AreaOption[]> => {
    const data = await unwrap(client.GET("/api/v1/areas"));
    return data.divisions.flatMap((division) =>
      division.districts.flatMap((district) =>
        district.areas.map(({ id, name }) => ({
          id,
          name,
          district: district.name,
        })),
      ),
    );
  },
};

let cached: Promise<AreaOption[]> | null = null;

/**
 * One request per page load, shared by searchAreas and useAreas. A failed request is
 * dropped from the cache so the next call tries again.
 */
export function loadAreas(): Promise<AreaOption[]> {
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
    gcTime: GC_MS,
    refetchOnWindowFocus: false,
  });
  return { ...query, areas: query.data ?? NO_AREAS };
}
