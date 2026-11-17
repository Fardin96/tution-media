import { useQuery } from "@tanstack/react-query";
import { client, unwrap } from "./api-client";
import type { Option } from "./profile";
import { queryKeys } from "./query-keys";

/** Subjects change rarely, so a mounted list is trusted for five minutes. */
const STALE_MS = 5 * 60_000;

const NO_SUBJECTS: Option[] = [];

/** Public GET /subjects: active subjects in display order, as {id, name} options. */
export const subjectApi = {
  list: async (): Promise<Option[]> => {
    const data = await unwrap(client.GET("/api/v1/subjects"));
    return data.subjects.map(({ id, name }) => ({ id, name }));
  },
};

let cached: Promise<Option[]> | null = null;

/**
 * One request per page load, shared by searchSubjects and useSubjects. A failed request is
 * dropped from the cache so the next call tries again.
 */
export function loadSubjects(): Promise<Option[]> {
  if (!cached) {
    const request = subjectApi.list();
    cached = request;
    request.catch(() => {
      if (cached === request) cached = null;
    });
  }
  return cached;
}

/** Call after a subject write so the next read goes to the server. */
export function clearSubjectCache(): void {
  cached = null;
}

/** The live subject list. `subjects` is [] until the first load succeeds. */
export function useSubjects() {
  const query = useQuery({
    queryKey: queryKeys.subjects,
    queryFn: loadSubjects,
    staleTime: STALE_MS,
  });
  return { ...query, subjects: query.data ?? NO_SUBJECTS };
}
