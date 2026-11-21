import type { Schemas } from "./api-client";
import fallback from "./site-content-defaults.json";

// Landing-page blocks and static pages managed from /dashboard/admin/site-content.
// Shapes come from lib/api-types.ts; the fallback copy (lib/site-content-defaults.json) is
// written by `yarn gen:site-defaults` from tuition-api's defaults.json, and is only used
// when the API can't be reached.

export type SiteContent = Schemas["SiteContent"];
export type HeroBlock = Schemas["SiteHeroBlock"];
export type NavBlock = Schemas["SiteNavBlock"];
export type CategoriesBlock = Schemas["SiteCategoriesBlock"];
export type TestimonialsBlock = Schemas["SiteTestimonialsBlock"];
export type Testimonial = Schemas["SiteTestimonial"];
export type ShowcaseBlock = Schemas["SiteShowcaseBlock"];
export type ShowcaseItem = Schemas["SiteShowcaseItem"];
export type HowItWorksBlock = Schemas["SiteHowItWorksBlock"];
export type HowItWorksFlow = Schemas["SiteHowItWorksFlow"];
export type FaqBlock = Schemas["SiteFaqBlock"];
export type CtaBannerBlock = Schemas["SiteCtaBannerBlock"];
export type FooterBlock = Schemas["SiteFooterBlock"];
export type SeoBlock = Schemas["SiteSeoBlock"];
// The static page without its slug and updatedAt: the shape the defaults file stores.
export type PageBlock = Omit<Schemas["SitePage"], "slug" | "updatedAt">;
export type SitePage = Schemas["SitePage"];
export type SiteLink = NavBlock["cta"];
export type StepIcon = HowItWorksFlow["steps"][number]["icon"];
export type SocialPlatform = FooterBlock["socials"][number]["platform"];

export type LandingKey = keyof SiteContent;
export type PageKey =
  "about_page" | "terms_page" | "privacy_page" | "contact_page";
export type SiteContentKey = LandingKey | PageKey;
export type BlockValue<K extends SiteContentKey> = K extends LandingKey
  ? SiteContent[K]
  : PageBlock;

export const PAGE_SLUGS = {
  "about-us": "about_page",
  terms: "terms_page",
  privacy: "privacy_page",
  contact: "contact_page",
} as const satisfies Record<string, PageKey>;
export type PageSlug = keyof typeof PAGE_SLUGS;

/** The defaults as shipped, keyed like the API. */
export const SITE_CONTENT_DEFAULTS = fallback as unknown as SiteContent &
  Record<PageKey, PageBlock>;

/**
 * True for an absolute http(s) URL, such as an uploaded file the API returns (R2 public or signed).
 * next/image can't optimize hosts it doesn't know, so those render with `unoptimized`.
 */
export function isRemoteSrc(src: string): boolean {
  return /^https?:\/\//.test(src);
}

export const LANDING_KEYS = [
  "hero",
  "nav",
  "categories",
  "testimonials",
  "showcase",
  "how_it_works",
  "faq",
  "cta_banner",
  "footer",
  "seo",
] as const satisfies readonly LandingKey[];

// The anchor each hideable section owns on the landing page.
const SECTION_ANCHORS = {
  testimonials: "testimonials",
  showcase: "tutors",
  how_it_works: "how-it-works",
  faq: "faq",
} as const satisfies Partial<Record<LandingKey, string>>;

/** Anchors of sections an admin has hidden, e.g. {"faq"}. */
export function hiddenAnchors(content: SiteContent): Set<string> {
  const hidden = new Set<string>();
  for (const [key, anchor] of Object.entries(SECTION_ANCHORS)) {
    if (!content[key as keyof typeof SECTION_ANCHORS].enabled)
      hidden.add(anchor);
  }
  return hidden;
}

/** Drops links to "/#anchor" when that section is hidden, so no link points at nothing. */
export function visibleLinks<T extends { href: string }>(
  links: readonly T[],
  hidden: ReadonlySet<string>,
): T[] {
  return links.filter((link) => {
    const match = /^\/#(.+)$/.exec(link.href);
    return !match || !hidden.has(match[1]);
  });
}

/** Icon artwork and its own colour; the chip behind it is a 10% tint of the colour. */
export const STEP_ICON_META: Record<
  StepIcon,
  { icon: string; hue: string; label: string }
> = {
  signup: {
    icon: "/assets/ic/ic-singup.png",
    hue: "#0066ff",
    label: "Sign up",
  },
  details: {
    icon: "/assets/ic/ic-upload.png",
    hue: "#ff9900",
    label: "Details",
  },
  search: { icon: "/assets/ic/ic-search.png", hue: "#002b6b", label: "Search" },
  documents: {
    icon: "/assets/ic/ic-briefcase.png",
    hue: "#002b6b",
    label: "Documents",
  },
  discovered: {
    icon: "/assets/ic/ic-discovered.png",
    hue: "#aa16ef",
    label: "Discovered",
  },
};

export const SOCIAL_META: Record<
  SocialPlatform,
  { name: string; icon: string }
> = {
  instagram: { name: "Instagram", icon: "/assets/ic/social/insta.png" },
  telegram: { name: "Telegram", icon: "/assets/ic/social/telegram.png" },
  tiktok: { name: "TikTok", icon: "/assets/ic/social/tiktok.png" },
  youtube: { name: "YouTube", icon: "/assets/ic/social/utube.png" },
};
