import {
  LANDING_KEYS,
  SITE_CONTENT_DEFAULTS,
  hiddenAnchors,
  visibleLinks,
} from "@/lib/site-content";

describe("hiddenAnchors", () => {
  it("is empty when every section is enabled", () => {
    expect(hiddenAnchors(SITE_CONTENT_DEFAULTS).size).toBe(0);
  });

  it("hides the faq anchor when the FAQ is disabled", () => {
    const content = {
      ...SITE_CONTENT_DEFAULTS,
      faq: { ...SITE_CONTENT_DEFAULTS.faq, enabled: false },
    };
    expect([...hiddenAnchors(content)]).toEqual(["faq"]);
  });

  it("hides the tutors anchor when the showcase is disabled", () => {
    const content = {
      ...SITE_CONTENT_DEFAULTS,
      showcase: { ...SITE_CONTENT_DEFAULTS.showcase, enabled: false },
    };
    expect([...hiddenAnchors(content)]).toEqual(["tutors"]);
  });
});

describe("visibleLinks", () => {
  const links = [
    { label: "FAQ", href: "/#faq" },
    { label: "Blog", href: "/blog" },
    { label: "Other", href: "/#faq-extra" },
    { label: "Site", href: "https://example.com" },
  ];

  it("keeps every link when nothing is hidden", () => {
    expect(visibleLinks(links, new Set())).toEqual(links);
  });

  it("drops only the links to a hidden anchor", () => {
    expect(visibleLinks(links, new Set(["faq"])).map((l) => l.label)).toEqual([
      "Blog",
      "Other",
      "Site",
    ]);
  });
});

describe("SITE_CONTENT_DEFAULTS", () => {
  it("has the 14 keys: 10 landing blocks and 4 static pages", () => {
    expect(Object.keys(SITE_CONTENT_DEFAULTS)).toHaveLength(14);
    expect(LANDING_KEYS).toHaveLength(10);
    for (const key of LANDING_KEYS) {
      expect(SITE_CONTENT_DEFAULTS).toHaveProperty(key);
    }
  });
});
