"use client";

import TagLine from "@/components/TagLine";
import SearchBar from "@/components/SearchBar";
import { ArrowLinkButton } from "@/components/arrow-link-button";
import { Faq } from "@/components/faq";
import { Footer } from "@/components/footer";
import { HowItWorks } from "@/components/how-it-works";
import { Navbar } from "@/components/navbar";
import { SectionHeader } from "@/components/section-header";
import { SitePageView } from "@/components/site-page";
import { Testimonials } from "@/components/testimonials";
import { TutorShowcase } from "@/components/tutor-showcase";
import { SearchSnippet } from "@/components/admin/site-content/editors";
import type {
  CategoriesBlock,
  CtaBannerBlock,
  FaqBlock,
  FooterBlock,
  HeroBlock,
  HowItWorksBlock,
  NavBlock,
  ShowcaseBlock,
  SitePage,
  SeoBlock,
  TestimonialsBlock,
} from "@/lib/site-content";
import type { SiteContentKey } from "@/lib/site-content-schema";

// Renders the real landing components with a block's draft. The saved footer and CTA banner are
// passed in so each of those two previews shows the other one as it is on the site.

export function BlockPreview({
  block,
  value,
  savedFooter,
  savedCta,
}: {
  block: SiteContentKey;
  /** A block value that passed validation. */
  value: unknown;
  savedFooter: FooterBlock;
  savedCta: CtaBannerBlock;
}) {
  switch (block) {
    case "hero": {
      const hero = value as HeroBlock;
      return (
        <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <TagLine line={hero.tagline} />
          <p className="max-w-4xl text-4xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-5xl">
            {hero.headline}
          </p>
          <p className="max-w-xl text-lg text-pretty text-[var(--color-neutral-gray)]">
            {hero.subline}
          </p>
          <SearchBar
            className="mt-4"
            skillPlaceholders={hero.skillPlaceholders}
            placePlaceholders={hero.placePlaceholders}
            searchLabel={hero.searchLabel}
          />
        </div>
      );
    }
    case "nav": {
      const nav = value as NavBlock;
      return <Navbar links={nav.links} cta={nav.cta} />;
    }
    case "categories": {
      const categories = value as CategoriesBlock;
      return (
        <section className="flex flex-col items-center gap-8 px-6 py-12">
          <SectionHeader
            titleId="site-content-preview-categories"
            title={categories.title}
            description={categories.description}
          />
          <ArrowLinkButton href={categories.cta.href} variant="solid">
            {categories.cta.label}
          </ArrowLinkButton>
        </section>
      );
    }
    // Keyed by the item count: the carousel keeps an index that would otherwise point past the end.
    case "testimonials": {
      const content = value as TestimonialsBlock;
      return <Testimonials key={content.items.length} content={content} />;
    }
    case "showcase":
      return <TutorShowcase content={value as ShowcaseBlock} />;
    case "how_it_works":
      return <HowItWorks content={value as HowItWorksBlock} />;
    // Keyed by the open question: the accordion only reads its default value on mount.
    case "faq": {
      const content = value as FaqBlock;
      return <Faq key={content.openIndex ?? "none"} content={content} />;
    }
    case "cta_banner":
      return (
        <Footer
          footer={savedFooter}
          cta={value as CtaBannerBlock}
          hiddenAnchors={[]}
        />
      );
    case "footer":
      return (
        <Footer
          footer={value as FooterBlock}
          cta={savedCta}
          hiddenAnchors={[]}
        />
      );
    case "seo": {
      const seo = value as SeoBlock;
      return (
        <div className="p-6">
          <SearchSnippet title={seo.title} description={seo.description} />
        </div>
      );
    }
    default: {
      const page = value as Omit<SitePage, "slug" | "updatedAt">;
      return <SitePageView page={{ ...page, slug: block, updatedAt: null }} />;
    }
  }
}
