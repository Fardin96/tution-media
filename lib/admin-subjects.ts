import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";
import { clearSubjectCache } from "./subjects";

export type AdminSubject = Schemas["AdminSubject"];

/** The fields an admin form sends. Create and update accept the same shape. */
export type SubjectFields = { name: string; slug?: string; sortOrder: number };

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const SORT_ORDER_MAX = 1000;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const adminSubjectApi = {
  list: () => unwrap(client.GET("/api/v1/admin/subjects")),
  create: (body: SubjectFields) =>
    unwrap(client.POST("/api/v1/admin/subjects", { body })),
  update: (id: number, body: Partial<SubjectFields> & { isActive?: boolean }) =>
    unwrap(
      client.PATCH("/api/v1/admin/subjects/{id}", {
        params: { path: { id } },
        body,
      }),
    ),
};

export function useAdminSubjects() {
  return useQuery({
    queryKey: queryKeys.admin.subjects,
    queryFn: adminSubjectApi.list,
    staleTime: 15_000,
  });
}

/** Subject writes change the admin list and the public list that every picker reads. */
function invalidateSubjects(queryClient: QueryClient) {
  clearSubjectCache();
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.subjects }),
    queryClient.invalidateQueries({ queryKey: queryKeys.subjects }),
  ]);
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubjectFields) => adminSubjectApi.create(body),
    onSuccess: () => invalidateSubjects(queryClient),
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: Partial<SubjectFields> & { isActive?: boolean };
    }) => adminSubjectApi.update(id, body),
    onSuccess: () => invalidateSubjects(queryClient),
  });
}

/** Required, 2 to 60 characters once trimmed. */
export function validateSubjectName(text: string): string | undefined {
  const name = text.trim();
  if (name === "") return "Enter a subject name.";
  if (name.length < NAME_MIN) return `Use at least ${NAME_MIN} characters.`;
  if (name.length > NAME_MAX) return `Use ${NAME_MAX} characters or fewer.`;
  return undefined;
}

/** Optional. Empty means the server makes one from the name. */
export function validateSlug(text: string): string | undefined {
  const slug = text.trim();
  if (slug === "") return undefined;
  if (!SLUG_PATTERN.test(slug))
    return "Use lowercase letters, numbers and dashes.";
  return undefined;
}

/** A whole number from 0 to 1000. */
export function validateSortOrder(text: string): string | undefined {
  const trimmed = text.trim();
  const value = Number(trimmed);
  if (
    trimmed === "" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > SORT_ORDER_MAX
  )
    return `Enter a whole number from 0 to ${SORT_ORDER_MAX}.`;
  return undefined;
}
