import { render, screen, within } from "@testing-library/react";
import { Faq } from "@/components/faq";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { Testimonials } from "@/components/testimonials";
import { SITE_CONTENT_DEFAULTS as D } from "@/lib/site-content";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Faq", () => {
  it("shows one item without anything open when openIndex is null", () => {
    render(
      <Faq content={{ ...D.faq, items: [D.faq.items[0]], openIndex: null }} />,
    );
    expect(screen.getByText("01")).toBeInTheDocument();
    const triggers = screen.getAllByRole("button");
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toHaveAttribute("aria-expanded", "false");
  });

  it("splits six items 3 and 3 and numbers them 01 to 06", () => {
    const items = [...D.faq.items, D.faq.items[0]].slice(0, 6);
    const { container } = render(
      <Faq content={{ ...D.faq, items, openIndex: null }} />,
    );
    const columns = container.querySelector(
      '[data-orientation="vertical"]',
    )?.children;
    expect(columns).toHaveLength(2);
    expect(columns?.[0].children).toHaveLength(3);
    expect(columns?.[1].children).toHaveLength(3);
    const numbers = Array.from(container.querySelectorAll("span[aria-hidden]"))
      .map((el) => el.textContent)
      .filter((text) => /^\d\d$/.test(text ?? ""));
    expect(numbers).toEqual(["01", "02", "03", "04", "05", "06"]);
  });
});

describe("Testimonials", () => {
  beforeAll(() => {
    // Autoplay and the card's visibility check use IntersectionObserver, which jsdom lacks.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("hides the arrows when there is only one testimonial", () => {
    render(
      <Testimonials
        content={{ ...D.testimonials, items: [D.testimonials.items[0]] }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Previous testimonial" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Next testimonial" }),
    ).not.toBeInTheDocument();
  });

  it("shows the arrows when there are several testimonials", () => {
    render(<Testimonials content={D.testimonials} />);
    expect(
      screen.getByRole("button", { name: "Previous testimonial" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next testimonial" }),
    ).toBeInTheDocument();
  });
});

describe("Footer", () => {
  it("drops links to a hidden anchor", () => {
    const { container } = render(
      <Footer footer={D.footer} cta={D.cta_banner} hiddenAnchors={["faq"]} />,
    );
    expect(container.querySelectorAll('a[href="/#faq"]')).toHaveLength(0);
    expect(
      container.querySelectorAll('a[href="/#tutors"]').length,
    ).toBeGreaterThan(0);
  });

  it("shows the brand name in the copyright", () => {
    render(
      <Footer
        footer={{ ...D.footer, brandName: "Acme Tutors" }}
        cta={D.cta_banner}
        hiddenAnchors={[]}
      />,
    );
    expect(
      screen.getByText(/Acme Tutors\. All rights reserved\./),
    ).toBeInTheDocument();
  });
});

describe("Navbar", () => {
  it("renders the links and CTA it is given", () => {
    render(
      <Navbar
        links={[{ label: "Pricing", href: "/pricing" }]}
        cta={{ label: "Join now", href: "/join" }}
      />,
    );
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(within(nav).getByRole("link", { name: "Join now" })).toHaveAttribute(
      "href",
      "/join",
    );
    expect(
      screen.queryByRole("link", { name: "Blogs" }),
    ).not.toBeInTheDocument();
  });
});
