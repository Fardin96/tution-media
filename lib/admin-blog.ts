import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import type { ApiError } from "./profile";
import { queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminBlogPost = Schemas["AdminBlogPost"];
export type BlogStatus = AdminBlogPost["status"];
export type CreateBlogPostBody = Schemas["CreateBlogPostInput"];
export type UpdateBlogPostBody = Schemas["UpdateBlogPostInput"];

export interface AdminBlogFilters {
  status?: BlogStatus;
}

export const adminBlogApi = {
  list: (filters: AdminBlogFilters, cursor?: string) =>
    unwrap(
      client.GET("/api/v1/admin/blog", {
        params: { query: { status: filters.status, cursor } },
      }),
    ),
  get: (id: string) =>
    unwrap(client.GET("/api/v1/admin/blog/{id}", { params: { path: { id } } })),
  create: (body: CreateBlogPostBody) =>
    unwrap(client.POST("/api/v1/admin/blog", { body })),
  update: (id: string, body: UpdateBlogPostBody) =>
    unwrap(
      client.PATCH("/api/v1/admin/blog/{id}", {
        params: { path: { id } },
        body,
      }),
    ),
  remove: (id: string) =>
    unwrap(
      client.DELETE("/api/v1/admin/blog/{id}", { params: { path: { id } } }),
    ),
};

export function useAdminBlogPosts(filters: AdminBlogFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.admin.blogPosts(filters),
    queryFn: ({ pageParam }) => adminBlogApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useAdminBlogPost(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.blogPost(id),
    queryFn: () => adminBlogApi.get(id),
    staleTime: 15_000,
  });
}

export function useCreateBlogPost() {
  const queryClient = useQueryClient();
  return useMutation<AdminBlogPost, ApiError, CreateBlogPostBody>({
    mutationFn: adminBlogApi.create,
    onSuccess: (post) => {
      queryClient.setQueryData(queryKeys.admin.blogPost(post.id), post);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.blogAll }),
  });
}

export function useUpdateBlogPost(id: string) {
  const queryClient = useQueryClient();
  return useMutation<AdminBlogPost, ApiError, UpdateBlogPostBody>({
    mutationFn: (body) => adminBlogApi.update(id, body),
    onSuccess: (post) => {
      queryClient.setQueryData(queryKeys.admin.blogPost(id), post);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.blogAll }),
  });
}

export function useDeleteBlogPost(id: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => adminBlogApi.remove(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.admin.blogPost(id) });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.blogAll }),
  });
}

/* ───────── Slugs and form rules (mirror tuition-api's blog schema) ───────── */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX = 120;
export const TITLE_MIN = 3;
export const TITLE_MAX = 160;
export const EXCERPT_MAX = 300;
export const BODY_MAX = 50_000;

/**
 * A link slug from a title: lowercase ASCII, runs of other characters become one hyphen, no
 * leading or trailing hyphen, at most 120 characters. Accents fold to their base letter. A title
 * with no Latin letters or digits gives "", and the form then asks for a slug by hand.
 */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

export interface BlogForm {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  /** The cover's FileAsset id, or null for no cover. */
  coverFileId: string | null;
}

export type BlogField = "title" | "slug" | "excerpt" | "body";

export const BLOG_FIELDS: readonly BlogField[] = [
  "title",
  "slug",
  "excerpt",
  "body",
];

export function emptyBlogForm(): BlogForm {
  return { title: "", slug: "", excerpt: "", body: "", coverFileId: null };
}

/** The form as saved on the server. */
export function blogFormFrom(post: AdminBlogPost): BlogForm {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    body: post.body,
    coverFileId: post.cover?.fileId ?? null,
  };
}

/** Inline messages for the fields that break a rule, or an empty object when the form is valid. */
export function validateBlogForm(
  form: BlogForm,
): Partial<Record<BlogField, string>> {
  const errors: Partial<Record<BlogField, string>> = {};
  const title = form.title.trim();
  const slug = form.slug.trim();
  const excerpt = form.excerpt.trim();
  const body = form.body.trim();

  if (!title) errors.title = "Enter a title.";
  else if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    errors.title = `Use ${TITLE_MIN} to ${TITLE_MAX} characters.`;
  }

  if (!slug) errors.slug = "Enter a link slug.";
  else if (slug.length > SLUG_MAX || !SLUG_PATTERN.test(slug)) {
    errors.slug =
      "Use lowercase letters and digits, with single hyphens between words.";
  }

  if (excerpt.length > EXCERPT_MAX) {
    errors.excerpt = `Keep the excerpt to ${EXCERPT_MAX} characters or fewer.`;
  }

  if (!body) errors.body = "Write the post body.";
  else if (body.length > BODY_MAX) {
    errors.body = "Keep the body to 50,000 characters or fewer.";
  }

  return errors;
}

/** The body for POST /admin/blog. Empty optional text is left out; the status is the button pressed. */
export function toCreateBlogPost(
  form: BlogForm,
  status: "DRAFT" | "PUBLISHED",
): CreateBlogPostBody {
  const body: CreateBlogPostBody = {
    title: form.title.trim(),
    slug: form.slug.trim(),
    body: form.body.trim(),
    status,
  };
  const excerpt = form.excerpt.trim();
  if (excerpt) body.excerpt = excerpt;
  if (form.coverFileId) body.coverFileId = form.coverFileId;
  return body;
}

/**
 * The PATCH body: only the fields that differ from `initial`. An empty excerpt sends null. The
 * cover is sent when it changed, as an id or null for removed.
 */
export function toBlogPatch(
  initial: BlogForm,
  form: BlogForm,
): UpdateBlogPostBody {
  const patch: UpdateBlogPostBody = {};
  const title = form.title.trim();
  if (title !== initial.title.trim()) patch.title = title;

  const slug = form.slug.trim();
  if (slug !== initial.slug.trim()) patch.slug = slug;

  const excerpt = form.excerpt.trim();
  if (excerpt !== initial.excerpt.trim()) {
    patch.excerpt = excerpt === "" ? null : excerpt;
  }

  const body = form.body.trim();
  if (body !== initial.body.trim()) patch.body = body;

  if (form.coverFileId !== initial.coverFileId) {
    patch.coverFileId = form.coverFileId;
  }
  return patch;
}

export const BLOG_STATUS_META: Record<
  BlogStatus,
  { label: string; tone: "neutral" | "success" | "warning" }
> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PUBLISHED: { label: "Published", tone: "success" },
  ARCHIVED: { label: "Archived", tone: "warning" },
};
