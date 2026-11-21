import { API_URL } from "./api";
import {
  LANDING_KEYS,
  PAGE_SLUGS,
  SITE_CONTENT_DEFAULTS,
  type PageSlug,
  type SiteContent,
  type SitePage,
} from "./site-content";

export const SITE_CONTENT_TAG = "site-content";
// Matches the API's public max-age. Admin saves refresh the tag right away.
const REVALIDATE_SECONDS = 300;

// A slow or unreachable API must not stall a page: past this, the bundled copy is used.
const TIMEOUT_MS = 5000;

async function fetchJson(path: string): Promise<unknown> {
  // Server code has no origin to resolve a relative URL against. Without an absolute
  // NEXT_PUBLIC_API_URL (e.g. a build where it is unset) there is nothing to ask, so skip the
  // request instead of starting one that fails and stalls static generation.
  if (!/^https?:\/\//.test(API_URL)) {
    throw new Error("NEXT_PUBLIC_API_URL is not an absolute URL");
  }
  const res = await fetch(`${API_URL}${path}`, {
    // no-cache asks a CDN in front of the API for a fresh copy.
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    next: { revalidate: REVALIDATE_SECONDS, tags: [SITE_CONTENT_TAG] },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GET ${path} answered ${res.status}`);
  return res.json();
}

/**
 * Every landing block. The API already swaps in defaults for unset or invalid rows; a block
 * missing from the reply, or a failed request (API down at build time), uses the bundled copy.
 */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const data = (await fetchJson(
      "/api/v1/site-content",
    )) as Partial<SiteContent>;
    return mergeWithDefaults(data);
  } catch (err) {
    console.warn(`site-content: using bundled defaults (${String(err)})`);
    return mergeWithDefaults({});
  }
}

export function mergeWithDefaults(
  data: Partial<SiteContent> | null,
): SiteContent {
  const merged = {} as Record<string, unknown>;
  for (const key of LANDING_KEYS) {
    const value = data && typeof data === "object" ? data[key] : undefined;
    merged[key] =
      value && typeof value === "object" ? value : SITE_CONTENT_DEFAULTS[key];
  }
  return merged as SiteContent;
}

/** A static page by its public slug, falling back to the bundled copy. */
export async function getSitePage(slug: PageSlug): Promise<SitePage> {
  try {
    const page = (await fetchJson(
      `/api/v1/site-content/pages/${slug}`,
    )) as SitePage;
    if (page && typeof page.body === "string") return page;
  } catch (err) {
    console.warn(`site-content: using bundled ${slug} page (${String(err)})`);
  }
  const block = SITE_CONTENT_DEFAULTS[PAGE_SLUGS[slug]];
  return { slug, ...block, updatedAt: null };
}
