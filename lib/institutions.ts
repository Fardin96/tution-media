import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";

export type InstitutionOption = Schemas["InstitutionOption"];
export type AdminInstitution = Schemas["AdminInstitution"];
export type InstitutionKind = Schemas["InstitutionOption"]["kind"];
/** The fields an admin form sends. Create and update accept the same shape. */
export type InstitutionFields = {
  name: string;
  kind: InstitutionKind;
  district?: string | null;
  area?: string | null;
  aliases?: string[];
};

export const KIND_LABEL: Record<InstitutionKind, string> = {
  UNIVERSITY: "University",
  COLLEGE: "College",
  SCHOOL: "School",
  SCHOOL_AND_COLLEGE: "School and college",
};

export const INSTITUTION_KINDS: InstitutionKind[] = [
  "UNIVERSITY",
  "COLLEGE",
  "SCHOOL",
  "SCHOOL_AND_COLLEGE",
];

/** "University · Dhaka, Dhaka": the kind, then the area and district, with missing parts left out. */
export function institutionDetails(institution: {
  kind: InstitutionKind;
  area: string | null;
  district: string | null;
}): string {
  const place = [institution.area, institution.district]
    .filter(Boolean)
    .join(", ");
  return [KIND_LABEL[institution.kind], place].filter(Boolean).join(" · ");
}

export const NAME_MIN = 2;
export const NAME_MAX = 150;
export const ALIASES_MAX = 20;
export const ALIAS_MIN = 2;
export const ALIAS_MAX = 60;

export const ADMIN_PAGE_SIZE = 50;

export type InstitutionFilters = {
  q?: string;
  kind?: InstitutionKind;
  status: "active" | "inactive" | "all";
};

/** Public search for the pickers. `forRole` only changes the order of the results. */
export const institutionApi = {
  search: async (
    q: string,
    forRole: "tutor" | "student",
    signal?: AbortSignal,
  ): Promise<InstitutionOption[]> =>
    (
      await unwrap(
        client.GET("/api/v1/institutions", {
          params: { query: { q, for: forRole } },
          signal,
        }),
      )
    ).institutions,
};

export const adminInstitutionApi = {
  list: (filters: InstitutionFilters, offset: number) =>
    unwrap(
      client.GET("/api/v1/admin/institutions", {
        params: {
          query: {
            q: filters.q || undefined,
            kind: filters.kind,
            status: filters.status,
            offset,
            limit: ADMIN_PAGE_SIZE,
          },
        },
      }),
    ),
  create: (body: InstitutionFields) =>
    unwrap(client.POST("/api/v1/admin/institutions", { body })),
  update: (
    id: number,
    body: Partial<InstitutionFields> & { isActive?: boolean },
  ) =>
    unwrap(
      client.PATCH("/api/v1/admin/institutions/{id}", {
        params: { path: { id } },
        body,
      }),
    ),
};

export function useAdminInstitutions(
  filters: InstitutionFilters,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.institutions(filters),
    queryFn: ({ pageParam }) => adminInstitutionApi.list(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce(
        (sum, page) => sum + page.institutions.length,
        0,
      );
      return loaded < last.total ? loaded : undefined;
    },
    enabled,
    staleTime: 15_000,
    // Keeps the last list on screen while a new search loads, so typing doesn't flash the skeleton.
    placeholderData: keepPreviousData,
  });
}

/** Institution writes change the admin list. Public search results are never cached here. */
function invalidateInstitutions(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.admin.institutionsAll,
  });
}

export function useCreateInstitution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: InstitutionFields) => adminInstitutionApi.create(body),
    onSuccess: () => invalidateInstitutions(queryClient),
  });
}

export function useUpdateInstitution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: Partial<InstitutionFields> & { isActive?: boolean };
    }) => adminInstitutionApi.update(id, body),
    onSuccess: () => invalidateInstitutions(queryClient),
  });
}

/** Comma separated; empty pieces are dropped. */
export function parseAliases(text: string): string[] {
  return text
    .split(",")
    .map((alias) => alias.trim())
    .filter(Boolean);
}

/** Required, 2 to 150 characters once trimmed. */
export function validateName(text: string): string | undefined {
  const name = text.trim();
  if (name === "") return "Enter a name.";
  if (name.length < NAME_MIN) return `Use at least ${NAME_MIN} characters.`;
  if (name.length > NAME_MAX) return `Use ${NAME_MAX} characters or fewer.`;
  return undefined;
}

export function validateAliases(names: string[]): string | undefined {
  if (names.length > ALIASES_MAX)
    return `Use ${ALIASES_MAX} short names or fewer.`;
  if (names.some((alias) => alias.length < ALIAS_MIN))
    return `Use at least ${ALIAS_MIN} characters for each short name.`;
  if (names.some((alias) => alias.length > ALIAS_MAX))
    return `Keep each short name to ${ALIAS_MAX} characters or fewer.`;
  return undefined;
}
