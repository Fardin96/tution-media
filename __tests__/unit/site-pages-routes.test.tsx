import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SitePage, SiteContent } from "@/lib/site-content";
import { getSitePage, getSiteContent } from "@/lib/site-content.server";
import AboutUsPage, {
  generateMetadata as aboutMetadata,
} from "@/app/(site)/about-us/page";
import TermsPage, {
  generateMetadata as termsMetadata,
} from "@/app/(site)/terms/page";
import PrivacyPage, {
  generateMetadata as privacyMetadata,
} from "@/app/(site)/privacy/page";
import ContactPage, {
  generateMetadata as contactMetadata,
} from "@/app/(site)/contact/page";

vi.mock("@/lib/site-content.server", () => ({
  getSitePage: vi.fn(),
  getSiteContent: vi.fn(),
}));

vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => null,
}));

const titles: Record<string, string> = {
  "about-us": "About Us",
  terms: "Terms and Conditions",
  privacy: "Privacy Policy",
  contact: "Contact Support",
};

function fixture(slug: string): SitePage {
  return {
    slug: slug as SitePage["slug"],
    title: titles[slug],
    description: `${titles[slug]} description`,
    body: "Some text.\n\n## Details\n\nMore text.",
    updatedAt: null,
  };
}

const footer = {
  address: "House 42, Road 11, Banani, Dhaka",
  phone: "+880 1700-000000",
  email: "support@mastershub.com",
};

beforeEach(() => {
  vi.mocked(getSitePage).mockImplementation(async (slug) => fixture(slug));
  vi.mocked(getSiteContent).mockResolvedValue({
    footer,
  } as unknown as SiteContent);
});

describe("site pages", () => {
  it.each([
    ["about-us", AboutUsPage, aboutMetadata],
    ["terms", TermsPage, termsMetadata],
    ["privacy", PrivacyPage, privacyMetadata],
    ["contact", ContactPage, contactMetadata],
  ] as const)(
    "%s renders its h1 and metadata title",
    async (slug, Page, metadata) => {
      render(await Page());
      expect(
        screen.getByRole("heading", { level: 1, name: titles[slug] }),
      ).toBeInTheDocument();

      const meta = await metadata();
      expect(meta.title).toBe(`${titles[slug]} · Masters Hub`);
      expect(meta.description).toBe(`${titles[slug]} description`);
    },
  );

  it("contact links the phone and email", async () => {
    render(await ContactPage());
    expect(
      screen.getByRole("link", { name: "+880 1700-000000" }),
    ).toHaveAttribute("href", "tel:+8801700000000");
    expect(
      screen.getByRole("link", { name: "support@mastershub.com" }),
    ).toHaveAttribute("href", "mailto:support@mastershub.com");
    expect(screen.getByText("Office")).toBeInTheDocument();
    expect(screen.getByText(footer.address)).toBeInTheDocument();
  });
});
