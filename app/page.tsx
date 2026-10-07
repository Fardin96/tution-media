import { MeshGradient } from "@/components/mesh-gradient/mesh-gradient";
import TagLine from "@/components/TagLine";
import SearchBar from "@/components/SearchBar";
import OurHeroes from "@/components/OurHeroes";
import { SectionHeader } from "@/components/section-header";
import { ArrowLinkButton } from "@/components/arrow-link-button";
import { TutorDirectory } from "@/components/tutor-directory";
import { Testimonials } from "@/components/testimonials";
import { TutorShowcase } from "@/components/tutor-showcase";
import { Faq } from "@/components/faq";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero Section */}
      <MeshGradient
        className="flex min-h-[80vh] flex-col items-center px-6 pt-[calc(var(--navbar-top-offset)+var(--navbar-height)+45px)] text-center"
        animated
      >
        <TagLine />

        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)] sm:text-5xl md:text-6xl lg:text-7xl">
          Find the right tutor, faster.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-[var(--color-neutral-gray)]">
          A smarter way to connect students and tutors—built for clarity, trust,
          and real results.
        </p>

        <SearchBar className="mt-[37px]" />

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
          title="Discover the Emerging Masters"
          description="Find the best master for your kids and boosts your results 10x!"
        />

        <TutorDirectory className="mt-10" />

        <ArrowLinkButton href="/talents" variant="solid" className="mt-10">
          View All
        </ArrowLinkButton>
      </section>

      {/* Testimonials Section */}
      <Testimonials />

      <TutorShowcase />

      <Faq />
    </div>
  );
}
