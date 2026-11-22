import { MeshGradient } from "@/components/mesh-gradient/mesh-gradient";
import TagLine from "@/components/TagLine";
import SearchBar from "@/components/SearchBar";
import OurHeroes from "@/components/OurHeroes";
import { SectionHeader } from "@/components/section-header";
import { ArrowLinkButton } from "@/components/arrow-link-button";
import { TutorDirectory } from "@/components/tutor-directory";
import { Testimonials } from "@/components/testimonials";
import { TutorShowcase } from "@/components/tutor-showcase";
import { HowItWorks } from "@/components/how-it-works";
import { Faq } from "@/components/faq";
import { Footer } from "@/components/footer";
import { hiddenAnchors } from "@/lib/site-content";
import { getSiteContentForPage } from "@/lib/site-content.server";

export default async function Home() {
  const content = await getSiteContentForPage();

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero Section */}
      <MeshGradient
        className="flex min-h-[80vh] flex-col items-center px-6 pt-[calc(var(--navbar-top-offset)+var(--navbar-height)+45px)] text-center"
        animated
      >
        <TagLine line={content.hero.tagline} />

        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)] sm:text-5xl md:text-6xl lg:text-7xl">
          {content.hero.headline}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-[var(--color-neutral-gray)]">
          {content.hero.subline}
        </p>

        <SearchBar
          className="mt-[37px]"
          skillPlaceholders={content.hero.skillPlaceholders}
          placePlaceholders={content.hero.placePlaceholders}
          searchLabel={content.hero.searchLabel}
        />

        <OurHeroes />
      </MeshGradient>

      {/* Categories Section */}
      <section
        id="categories"
        aria-labelledby="categories-title"
        className="flex scroll-mt-[calc(var(--navbar-top-offset)+var(--navbar-height))] flex-col items-center bg-[var(--color-neutral-off-white)] px-6 py-14 sm:py-16 lg:py-[88px]"
      >
        <SectionHeader
          titleId="categories-title"
          title={content.categories.title}
          description={content.categories.description}
        />

        <TutorDirectory className="mt-10" />

        <ArrowLinkButton
          href={content.categories.cta.href}
          variant="solid"
          className="mt-10"
        >
          {content.categories.cta.label}
        </ArrowLinkButton>
      </section>

      {/* Testimonials Section */}
      {content.testimonials.enabled && (
        <Testimonials content={content.testimonials} />
      )}

      {content.showcase.enabled && <TutorShowcase content={content.showcase} />}

      {content.how_it_works.enabled && (
        <HowItWorks content={content.how_it_works} />
      )}

      {content.faq.enabled && <Faq content={content.faq} />}

      <Footer
        footer={content.footer}
        cta={content.cta_banner}
        hiddenAnchors={[...hiddenAnchors(content)]}
      />
    </div>
  );
}
