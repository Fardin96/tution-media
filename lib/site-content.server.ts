import { PHASE_PRODUCTION_BUILD } from "next/constants";
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
// Under the 1 h life of signed media links (the API's EMBED_URL_TTL), so a cached page never
// outlives its media. Admin saves and story withdrawals refresh the tag right away.
const REVALIDATE_SECONDS = 1800;

// A slow or unreachable API must not stall a page: past this, the bundled copy is used.
const TIMEOUT_MS = 3000;

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
 * Whether a failed read may use the bundled copy. Only a build with the API down (static
 * generation) and development may. In production a failure is rethrown, so ISR keeps serving
 * the last good page instead of caching defaults over the admin's content.
 */
function mayUseBundledCopy(): boolean {
  return (
    process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD ||
    process.env.NODE_ENV !== "production"
  );
}

async function readSiteContent(): Promise<SiteContent> {
  const data = (await fetchJson(
    "/api/v1/site-content",
  )) as Partial<SiteContent>;
  return mergeWithDefaults(data);
}

async function readSitePage(slug: PageSlug): Promise<SitePage> {
  const page = (await fetchJson(
    `/api/v1/site-content/pages/${slug}`,
  )) as SitePage;
  if (page && typeof page.body === "string") return page;
  throw new Error(`GET ${slug} page reply has no body`);
}

function bundledPage(slug: PageSlug): SitePage {
  const block = SITE_CONTENT_DEFAULTS[PAGE_SLUGS[slug]];
  return { slug, ...block, updatedAt: null };
}

/**
 * Every landing block. The API already swaps in defaults for unset or invalid rows; a block
 * missing from the reply, or a failed request, uses the bundled copy. Never throws, so it suits
 * code that runs on every page (the root metadata). Pages use getSiteContentForPage.
 */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    return await readSiteContent();
  } catch (err) {
    console.warn(`site-content: using bundled defaults (${String(err)})`);
    return mergeWithDefaults({});
  }
}

/**
 * The landing's content for a page that is cached (ISR). A failed read falls back to the bundled
 * copy only at build time or in development; in production it rethrows, so the cached page is
 * kept (see the ISR guide: the last successfully generated data keeps being served).
 */
export async function getSiteContentForPage(): Promise<SiteContent> {
  try {
    return await readSiteContent();
  } catch (err) {
    if (!mayUseBundledCopy()) throw err;
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

/** A static page by its public slug, falling back to the bundled copy. Never throws. */
export async function getSitePage(slug: PageSlug): Promise<SitePage> {
  try {
    return await readSitePage(slug);
  } catch (err) {
    console.warn(`site-content: using bundled ${slug} page (${String(err)})`);
    return bundledPage(slug);
  }
}

/**
 * A static page for a cached route. Same fallback rule as getSiteContentForPage: the bundled
 * copy only at build time or in development, otherwise the error is rethrown.
 */
export async function getSitePageForPage(slug: PageSlug): Promise<SitePage> {
  try {
    return await readSitePage(slug);
  } catch (err) {
    if (!mayUseBundledCopy()) throw err;
    console.warn(`site-content: using bundled ${slug} page (${String(err)})`);
    return bundledPage(slug);
  }
}
