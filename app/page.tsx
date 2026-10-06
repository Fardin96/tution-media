import { MeshGradient } from "@/components/mesh-gradient/mesh-gradient";
import TagLine from "@/components/TagLine";
import SearchBar from "@/components/SearchBar";
import OurHeroes from "@/components/OurHeroes";
import { SectionHeader } from "@/components/section-header";
import { ArrowLinkButton } from "@/components/arrow-link-button";
import { CategoryTabs } from "@/components/category-tabs";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
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

        <CategoryTabs className="mt-10">
          {/* ponytail: cards go here as TabsContent (Figma 4021:474) */}
        </CategoryTabs>

        <ArrowLinkButton href="/talents" variant="solid" className="mt-10">
          View All
        </ArrowLinkButton>
      </section>
    </div>
  );
}
