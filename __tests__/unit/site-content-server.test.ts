import {
  LANDING_KEYS,
  SITE_CONTENT_DEFAULTS,
  type SiteContent,
} from "@/lib/site-content";
import { getSiteContent, getSitePage } from "@/lib/site-content.server";

// Everything the landing reads, as the API would reply with it.
function landing(): Partial<SiteContent> {
  return Object.fromEntries(
    LANDING_KEYS.map((key) => [key, SITE_CONTENT_DEFAULTS[key]]),
  ) as Partial<SiteContent>;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("getSiteContent", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the API reply as it is when it is complete", async () => {
    const reply = landing();
    reply.seo = { title: "Remote title", description: "Remote" };
    fetchMock.mockResolvedValue(json(reply));

    const content = await getSiteContent();

    expect(content.seo).toEqual(reply.seo);
    expect(content.hero).toEqual(SITE_CONTENT_DEFAULTS.hero);
    expect(content).toEqual(reply);
  });

  it("falls back to the defaults when the API answers 500", async () => {
    fetchMock.mockResolvedValue(json({ error: "boom" }, 500));
    expect(await getSiteContent()).toEqual(landing());
  });

  it("falls back to the defaults on a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await getSiteContent()).toEqual(landing());
  });

  it("fills a missing key and a non-object block from the defaults", async () => {
    const reply: Record<string, unknown> = {
      ...landing(),
      testimonials: "oops",
    };
    delete reply.faq;
    fetchMock.mockResolvedValue(json(reply));

    const content = await getSiteContent();

    expect(content.faq).toEqual(SITE_CONTENT_DEFAULTS.faq);
    expect(content.testimonials).toEqual(SITE_CONTENT_DEFAULTS.testimonials);
    expect(content.hero).toEqual(reply.hero);
  });
});

describe("getSitePage", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back to the page default with updatedAt null on 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: "not found" }, 404)),
    );

    expect(await getSitePage("about-us")).toEqual({
      slug: "about-us",
      ...SITE_CONTENT_DEFAULTS.about_page,
      updatedAt: null,
    });
  });
});
