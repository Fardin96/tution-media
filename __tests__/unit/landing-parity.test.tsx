import { renderToStaticMarkup } from "react-dom/server";
import Home from "@/app/(site)/page";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Faq } from "@/components/faq";
import { HowItWorks } from "@/components/how-it-works";
import { Testimonials } from "@/components/testimonials";
import { TutorShowcase } from "@/components/tutor-showcase";
import TagLine from "@/components/TagLine";
import SearchBar from "@/components/SearchBar";
import {
  SITE_CONTENT_DEFAULTS as D,
  hiddenAnchors,
  visibleLinks,
} from "@/lib/site-content";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/site-content.server", async () => {
  const { SITE_CONTENT_DEFAULTS } = await import("@/lib/site-content");
  return {
    getSiteContent: async () => SITE_CONTENT_DEFAULTS,
    getSiteContentForPage: async () => SITE_CONTENT_DEFAULTS,
  };
});

// Snapshots pin the year in the footer copyright.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-21T06:00:00Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("landing parity", () => {
  it("testimonials", () => {
    expect(
      renderToStaticMarkup(<Testimonials content={D.testimonials} />),
    ).toMatchSnapshot();
  });

  it("tutor showcase", () => {
    expect(
      renderToStaticMarkup(<TutorShowcase content={D.showcase} />),
    ).toMatchSnapshot();
  });

  it("how it works", () => {
    expect(
      renderToStaticMarkup(<HowItWorks content={D.how_it_works} />),
    ).toMatchSnapshot();
  });

  it("faq", () => {
    expect(renderToStaticMarkup(<Faq content={D.faq} />)).toMatchSnapshot();
  });

  it("footer", () => {
    expect(
      renderToStaticMarkup(
        <Footer
          footer={D.footer}
          cta={D.cta_banner}
          hiddenAnchors={[...hiddenAnchors(D)]}
        />,
      ),
    ).toMatchSnapshot();
  });

  it("navbar", () => {
    expect(
      renderToStaticMarkup(
        <Navbar
          links={visibleLinks(D.nav.links, hiddenAnchors(D))}
          cta={D.nav.cta}
        />,
      ),
    ).toMatchSnapshot();
  });

  it("tagline", () => {
    expect(renderToStaticMarkup(<TagLine />)).toMatchSnapshot();
  });

  it("search bar", () => {
    expect(
      renderToStaticMarkup(
        <SearchBar
          skillPlaceholders={D.hero.skillPlaceholders}
          placePlaceholders={D.hero.placePlaceholders}
          searchLabel={D.hero.searchLabel}
        />,
      ),
    ).toMatchSnapshot();
  });

  it("home page (hero and categories included)", async () => {
    expect(renderToStaticMarkup(await Home())).toMatchSnapshot();
  });
});
