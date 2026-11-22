import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { getStoredTokens } from "./api";
import { formatDateTime } from "./admin";
import { ApiError } from "./profile";
import { queryKeys } from "./query-keys";
import { refreshSiteContent } from "./site-content.actions";
import {
  BLOCK_SCHEMAS,
  fileRefId,
  MEDIA_FIELD_KINDS,
  type BlockValue,
  type CardSource,
  type SiteContentKey,
} from "./site-content-schema";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type AdminSiteContentItem = Schemas["AdminSiteContentItem"];
export type AdminSiteContentList = Schemas["AdminSiteContentList"];
export type AdminSiteSource = Schemas["AdminSiteSource"];
/** The card lists a submission can be added to. */
export type SourceList = "testimonials" | "showcase";
export type TestimonialCard = BlockValue<"testimonials">["items"][number];
export type ShowcaseCard = BlockValue<"showcase">["items"][number];

export const siteContentAdminApi = {
  list: () => unwrap(client.GET("/api/v1/admin/site-content")),
  update: (
    key: SiteContentKey,
    value: unknown,
    expectedUpdatedAt: string | null,
  ) =>
    unwrap(
      client.PUT("/api/v1/admin/site-content/{key}", {
        params: { path: { key } },
        body: { value, expectedUpdatedAt },
      }),
    ),
  reset: (key: SiteContentKey, expectedUpdatedAt: string | null) =>
    unwrap(
      client.DELETE("/api/v1/admin/site-content/{key}", {
        params: {
          path: { key },
          query: { expectedUpdatedAt: expectedUpdatedAt ?? undefined },
        },
      }),
    ),
};

export function useAdminSiteContent() {
  return useQuery({
    queryKey: queryKeys.admin.siteContent,
    queryFn: siteContentAdminApi.list,
    staleTime: 15_000,
  });
}

export const siteSourcesApi = {
  list: (list: SourceList) =>
    unwrap(
      client.GET("/api/v1/admin/site-content/sources", {
        params: { query: { for: list } },
      }),
    ),
};

/** Approved submissions to add to a card list. Staleness 0: each open of the dialog refetches. */
export function useSiteSources(list: SourceList, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.siteSources(list),
    queryFn: () => siteSourcesApi.list(list),
    enabled,
    staleTime: 0,
  });
}

/** Puts the saved item into the list, so the editor and the picker show it without a refetch. */
function writeItem(queryClient: QueryClient, item: AdminSiteContentItem) {
  queryClient.setQueryData<AdminSiteContentList>(
    queryKeys.admin.siteContent,
    (prev) =>
      prev && {
        items: prev.items.map((row) => (row.key === item.key ? item : row)),
      },
  );
}

/**
 * The landing caches its content for up to 30 minutes. A saved change asks the server to expire
 * that cache now. Failure is ignored: the landing still catches up on its own.
 */
async function refreshLanding() {
  const tokens = getStoredTokens();
  if (!tokens) return;
  try {
    await refreshSiteContent(tokens.accessToken);
  } catch {
    // The landing refreshes within 30 minutes anyway.
  }
}

/** A 409 means the list is stale, so refetch it. The editor keeps its own copy until the admin reloads. */
function onConflict(queryClient: QueryClient, err: ApiError) {
  if (err.status === 409) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.siteContent,
    });
  }
}

export function useUpdateSiteContent(key: SiteContentKey) {
  const queryClient = useQueryClient();
  return useMutation<
    AdminSiteContentItem,
    ApiError,
    { value: unknown; expectedUpdatedAt: string | null }
  >({
    mutationFn: ({ value, expectedUpdatedAt }) =>
      siteContentAdminApi.update(key, value, expectedUpdatedAt),
    onSuccess: (item) => {
      writeItem(queryClient, item);
      void refreshLanding();
    },
    onError: (err) => onConflict(queryClient, err),
  });
}

export function useResetSiteContent(key: SiteContentKey) {
  const queryClient = useQueryClient();
  return useMutation<
    AdminSiteContentItem,
    ApiError,
    { expectedUpdatedAt: string | null }
  >({
    mutationFn: ({ expectedUpdatedAt }) =>
      siteContentAdminApi.reset(key, expectedUpdatedAt),
    onSuccess: (item) => {
      writeItem(queryClient, item);
      void refreshLanding();
    },
    onError: (err) => onConflict(queryClient, err),
  });
}

/* ───────── Validation ───────── */

export type BlockCheck<T> =
  { ok: true; value: T } | { ok: false; errors: Record<string, string> };

/** "items.2.quote" for a path; the first message per path wins. */
function issuePath(path: readonly PropertyKey[]): string {
  return path.map(String).join(".");
}

/** Validates a block's draft with the same schema the API uses. `value` is the trimmed, parsed block. */
export function validateBlock<K extends SiteContentKey>(
  key: K,
  value: unknown,
): BlockCheck<BlockValue<K>> {
  const result = BLOCK_SCHEMAS[key].safeParse(value);
  if (result.success) return { ok: true, value: result.data as BlockValue<K> };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issuePath(issue.path);
    if (!(path in errors)) errors[path] = issue.message;
  }
  return { ok: false, errors };
}

/** Server validation issues as field errors. Paths lose the leading "value." so they match validateBlock. */
export function apiFieldErrors(err: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!(err instanceof ApiError) || err.status !== 400) return errors;
  for (const issue of err.issues ?? []) {
    const path = issue.path.map(String);
    if (path[0] === "value") path.shift();
    if (path.length === 0) continue;
    const key = path.join(".");
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

/* ───────── Media ───────── */

/** What the editor knows about an uploaded file: a URL to show it, and its name. */
export interface MediaEntry {
  url: string | null;
  contentType: string;
  originalName: string | null;
}

/** Keyed by file id, the way the API's `media` map is. */
export type MediaMap = Record<string, MediaEntry>;

/**
 * Walks a block value and rebuilds it, passing each "file:<id>" string under a media key
 * (photo, thumbnail, video) to `replace`. Other values are kept. Never changes its input.
 */
function mapMediaRefs(
  node: unknown,
  replace: (ref: string) => string,
  inMedia = false,
): unknown {
  if (typeof node === "string") {
    return inMedia && fileRefId(node) ? replace(node) : node;
  }
  if (Array.isArray(node)) {
    return node.map((child) => mapMediaRefs(child, replace));
  }
  if (typeof node === "object" && node !== null) {
    return Object.fromEntries(
      Object.entries(node).map(([key, child]) => [
        key,
        mapMediaRefs(
          child,
          replace,
          Object.prototype.hasOwnProperty.call(MEDIA_FIELD_KINDS, key),
        ),
      ]),
    );
  }
  return node;
}

/**
 * A copy of a block value with each media ref swapped for its URL, so the preview can show
 * uploads. A ref with no URL in `media` is left as it is.
 */
export function resolveMedia<T>(value: T, media: MediaMap): T {
  return mapMediaRefs(value, (ref) => {
    const id = fileRefId(ref);
    return (id && media[id]?.url) || ref;
  }) as T;
}

/** The file ids a block value refers to, so the editor can drop uploads the draft no longer uses. */
export function mediaRefIds(value: unknown): Set<string> {
  const ids = new Set<string>();
  mapMediaRefs(value, (ref) => {
    const id = fileRefId(ref);
    if (id) ids.add(id);
    return ref;
  });
  return ids;
}

/* ───────── Submissions ───────── */

/** A card for a list, filled from a submission. Empty fields stay empty for the admin to fill in. */
export function cardFromSource(
  list: "testimonials",
  source: AdminSiteSource,
): TestimonialCard;
export function cardFromSource(
  list: "showcase",
  source: AdminSiteSource,
): ShowcaseCard;
export function cardFromSource(
  list: SourceList,
  source: AdminSiteSource,
): TestimonialCard | ShowcaseCard;
export function cardFromSource(
  list: SourceList,
  src: AdminSiteSource,
): TestimonialCard | ShowcaseCard {
  if (list === "testimonials") {
    return {
      name: src.authorName,
      role: src.role === "STUDENT" ? "Student" : "Tutor",
      photo: src.imageRef ?? "",
      quote: src.headline ?? "",
      comment: src.body ?? "",
      ...(src.videoRef ? { video: src.videoRef } : {}),
      source: src.source,
    };
  }
  if (src.source.kind === "tutor_video") {
    return {
      kind: "video",
      name: src.authorName,
      subject: src.subjectHint ?? "",
      thumbnail: "",
      video: src.videoRef ?? "",
      source: src.source,
    };
  }
  return {
    kind: "comment",
    name: src.authorName,
    subject: src.subjectHint ?? "",
    thumbnail: src.imageRef ?? "",
    university: src.instituteHint ?? "",
    comment: src.body ?? "",
    source: src.source,
  };
}

/** The key a card's source is compared by, so a submission is never added twice. */
export function sourceKey(source: CardSource): string {
  return `${source.kind}:${source.id}`;
}

/** Which file each submission supplied, keyed by file id: the "Uploaded by" line on a card. */
export function sourceOwners(
  sources: AdminSiteSource[],
): Record<string, string> {
  const owners: Record<string, string> = {};
  for (const src of sources) {
    for (const ref of [src.imageRef, src.videoRef]) {
      const id = ref ? fileRefId(ref) : null;
      if (id) owners[id] = src.authorName;
    }
  }
  return owners;
}

const AGREED_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

/** "Agreed 18 Nov 2026": the day the submitter agreed to home page use. */
export function agreedText(consentAt: string): string {
  const date = new Date(consentAt);
  return `Agreed ${Number.isNaN(date.getTime()) ? consentAt : AGREED_DATE.format(date)}`;
}

/* ───────── Picker and copy ───────── */

export type BlockGroup = "Landing page" | "Pages";

export interface BlockMeta {
  key: SiteContentKey;
  label: string;
  description: string;
  group: BlockGroup;
}

/** The order of the block picker. Every key appears once. */
export const BLOCK_META: readonly BlockMeta[] = [
  {
    key: "hero",
    label: "Hero",
    description:
      "The tagline, headline and search box at the top of the home page.",
    group: "Landing page",
  },
  {
    key: "nav",
    label: "Navigation bar",
    description: "The links and the register button in the top bar.",
    group: "Landing page",
  },
  {
    key: "categories",
    label: "Categories",
    description: "The heading and button above the tutor directory.",
    group: "Landing page",
  },
  {
    key: "testimonials",
    label: "Testimonials",
    description: "Quotes from students and parents, shown as rotating cards.",
    group: "Landing page",
  },
  {
    key: "showcase",
    label: "Tutor showcase",
    description: "A scrolling row of tutor videos and comments.",
    group: "Landing page",
  },
  {
    key: "how_it_works",
    label: "How it works",
    description:
      "The two step flows, for finding a tutor and for becoming one.",
    group: "Landing page",
  },
  {
    key: "faq",
    label: "FAQ",
    description: "Questions and answers. One question can start open.",
    group: "Landing page",
  },
  {
    key: "cta_banner",
    label: "Call to action",
    description: "The banner that sits on top of the footer.",
    group: "Landing page",
  },
  {
    key: "footer",
    label: "Footer",
    description:
      "Contact details, link columns, social links and the brand name.",
    group: "Landing page",
  },
  {
    key: "seo",
    label: "Search and sharing",
    description:
      "The page title and description used by search results and link previews.",
    group: "Landing page",
  },
  {
    key: "about_page",
    label: "About us",
    description: "The About us page at /about-us.",
    group: "Pages",
  },
  {
    key: "terms_page",
    label: "Terms and conditions",
    description: "The Terms page at /terms.",
    group: "Pages",
  },
  {
    key: "privacy_page",
    label: "Privacy policy",
    description: "The Privacy page at /privacy.",
    group: "Pages",
  },
  {
    key: "contact_page",
    label: "Contact",
    description: "The Contact page at /contact.",
    group: "Pages",
  },
];

/** Images under public/assets/avatar-demo, the only photos the editor offers. */
export const IMAGE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "/assets/avatar-demo/client/client1.png", label: "Client photo 1" },
  { value: "/assets/avatar-demo/client/client2.png", label: "Client photo 2" },
  { value: "/assets/avatar-demo/tutor/tutor1.png", label: "Tutor photo 1" },
  { value: "/assets/avatar-demo/tutor/tutor2.png", label: "Tutor photo 2" },
  { value: "/assets/avatar-demo/tutor/tutor3.png", label: "Tutor photo 3" },
  { value: "/assets/avatar-demo/tutor/tutor4.png", label: "Tutor photo 4" },
];

/** Videos under public/videos. */
export const VIDEO_OPTIONS: readonly { value: string; label: string }[] = [
  "how-to-guardians.mp4",
  "how-to-tutor.mp4",
  "tutor1.mp4",
  "tutor2.mp4",
  "tutor3.mp4",
  "tutor4.mp4",
  "tutor5.mp4",
  "tutor6.mp4",
  "tutor7.mp4",
  "tutor8.mp4",
].map((file) => ({ value: `/videos/${file}`, label: file }));

/** "Showing the default", or when it was last saved and by whom. */
export function updatedText(item: AdminSiteContentItem): string {
  if (item.isDefault) return "Showing the default";
  return `Edited ${formatDateTime(item.updatedAt)} by ${item.updatedByName ?? "a removed admin"}`;
}

/** A change to the FAQ's question list, as the list editor reports it. */
export type QuestionChange =
  | { type: "remove"; index: number }
  | { type: "move"; from: number; to: number };

/**
 * Where the open question sits after a change to the list. The open question follows its own
 * item: a removed open question closes (null), and items moved past it shift its index.
 */
export function adjustOpenIndex(
  openIndex: number | null,
  change: QuestionChange,
): number | null {
  if (openIndex === null) return null;
  if (change.type === "remove") {
    if (openIndex === change.index) return null;
    return openIndex > change.index ? openIndex - 1 : openIndex;
  }
  const { from, to } = change;
  if (openIndex === from) return to;
  if (from < openIndex && openIndex <= to) return openIndex - 1;
  if (to <= openIndex && openIndex < from) return openIndex + 1;
  return openIndex;
}
