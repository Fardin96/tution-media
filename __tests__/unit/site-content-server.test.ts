import {
  LANDING_KEYS,
  SITE_CONTENT_DEFAULTS,
  type SiteContent,
} from "@/lib/site-content";
import { updateTag } from "next/cache";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import {
  refreshSiteContent,
  refreshSiteContentForUser,
} from "@/lib/site-content.actions";
import {
  getSiteContent,
  getSiteContentForPage,
  getSitePage,
  getSitePageForPage,
} from "@/lib/site-content.server";

vi.mock("next/cache", () => ({ updateTag: vi.fn() }));

// Pin the API origin so the tests don't depend on .env.local; a test can blank it.
const api = vi.hoisted(() => ({ url: "https://api.test" }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  get API_URL() {
    return api.url;
  },
}));

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

// The fallback rule reads these at call time, so each test sets them and the originals come back.
const env = process.env as Record<string, string | undefined>;
const originalEnv = { NODE_ENV: env.NODE_ENV, NEXT_PHASE: env.NEXT_PHASE };

function setEnv(nodeEnv: string, nextPhase?: string) {
  env.NODE_ENV = nodeEnv;
  if (nextPhase === undefined) delete env.NEXT_PHASE;
  else env.NEXT_PHASE = nextPhase;
}

function restoreEnv() {
  env.NODE_ENV = originalEnv.NODE_ENV;
  if (originalEnv.NEXT_PHASE === undefined) delete env.NEXT_PHASE;
  else env.NEXT_PHASE = originalEnv.NEXT_PHASE;
}

describe("getSiteContent", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    api.url = "https://api.test";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the bundled copy without a request when the API URL is not absolute", async () => {
    api.url = "";

    const content = await getSiteContent();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(content).toEqual(landing());
  });

  it("gives up on a slow API and uses the bundled copy", async () => {
    // Every request carries an abort signal; the 3 s timeout rejects like this.
    fetchMock.mockRejectedValue(
      new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      ),
    );

    const content = await getSiteContent();

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(content).toEqual(landing());
  });

  it("caches the landing for 1800 s and tags it for on-demand refresh", async () => {
    fetchMock.mockResolvedValue(json(landing()));

    await getSiteContent();

    expect(fetchMock.mock.calls[0][1].next).toEqual({
      revalidate: 1800,
      tags: ["site-content"],
    });
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

  it("uses the defaults in production for the lenient readers", async () => {
    setEnv("production");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );

    expect(await getSiteContent()).toEqual(landing());
    expect(await getSitePage("about-us")).toEqual({
      slug: "about-us",
      ...SITE_CONTENT_DEFAULTS.about_page,
      updatedAt: null,
    });
  });
});

describe("strict page readers", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    restoreEnv();
    api.url = "https://api.test";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("in production at runtime", () => {
    beforeEach(() => setEnv("production"));

    it("rethrows an API error so ISR keeps the last good landing", async () => {
      fetchMock.mockResolvedValue(json({ error: "boom" }, 500));

      await expect(getSiteContentForPage()).rejects.toThrow(
        "GET /api/v1/site-content answered 500",
      );
    });

    it("rethrows a network error for the landing", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));

      await expect(getSiteContentForPage()).rejects.toThrow("fetch failed");
    });

    it("rethrows an API error for a static page", async () => {
      fetchMock.mockResolvedValue(json({ error: "boom" }, 500));

      await expect(getSitePageForPage("terms")).rejects.toThrow("answered 500");
    });

    it("rethrows when a page reply has no body", async () => {
      fetchMock.mockResolvedValue(json({ slug: "terms" }));

      await expect(getSitePageForPage("terms")).rejects.toThrow("no body");
    });

    it("rethrows without a request when the API URL is not absolute", async () => {
      api.url = "";

      await expect(getSiteContentForPage()).rejects.toThrow(
        "NEXT_PUBLIC_API_URL is not an absolute URL",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns the landing reply when it succeeds", async () => {
      const reply = landing();
      reply.seo = { title: "Remote title", description: "Remote" };
      fetchMock.mockResolvedValue(json(reply));

      expect((await getSiteContentForPage()).seo).toEqual(reply.seo);
    });

    it("returns the page reply when it succeeds", async () => {
      const page = {
        slug: "terms",
        title: "Terms",
        description: "Terms description",
        body: "Some text.",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      fetchMock.mockResolvedValue(json(page));

      expect(await getSitePageForPage("terms")).toEqual(page);
    });
  });

  describe("at build time with the API down", () => {
    beforeEach(() => setEnv("production", PHASE_PRODUCTION_BUILD));

    it("uses the bundled landing", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));

      expect(await getSiteContentForPage()).toEqual(landing());
    });

    it("uses the bundled page with updatedAt null", async () => {
      fetchMock.mockResolvedValue(json({ error: "boom" }, 500));

      expect(await getSitePageForPage("privacy")).toEqual({
        slug: "privacy",
        ...SITE_CONTENT_DEFAULTS.privacy_page,
        updatedAt: null,
      });
    });
  });

  describe("in development", () => {
    beforeEach(() => setEnv("development"));

    it("uses the bundled landing", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));

      expect(await getSiteContentForPage()).toEqual(landing());
    });

    it("uses the bundled page with updatedAt null", async () => {
      fetchMock.mockResolvedValue(json({ error: "boom" }, 500));

      expect(await getSitePageForPage("contact")).toEqual({
        slug: "contact",
        ...SITE_CONTENT_DEFAULTS.contact_page,
        updatedAt: null,
      });
    });
  });
});

describe("refreshSiteContentForUser", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(updateTag).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("checks the token against GET /api/v1/me without a cache", async () => {
    fetchMock.mockResolvedValue(json({ id: "u1" }));

    await refreshSiteContentForUser("user-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/v1/me");
    expect(init.headers.Authorization).toBe("Bearer user-token");
    expect(init.cache).toBe("no-store");
  });

  it("rejects a token /me refuses and leaves the landing cache alone", async () => {
    fetchMock.mockResolvedValue(json({ error: "unauthorized" }, 401));

    expect(await refreshSiteContentForUser("stale-token")).toBe(false);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("expires the landing tag when /me accepts the token", async () => {
    fetchMock.mockResolvedValue(json({ id: "u1" }));

    expect(await refreshSiteContentForUser("user-token")).toBe(true);
    expect(updateTag).toHaveBeenCalledWith("site-content");
  });

  it("does not check the admin endpoint", async () => {
    fetchMock.mockResolvedValue(json({ id: "u1" }));

    await refreshSiteContentForUser("user-token");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.test/api/v1/me",
    ]);
  });

  it("still asks the admin endpoint in refreshSiteContent", async () => {
    fetchMock.mockResolvedValue(json({ items: [] }));

    await refreshSiteContent("admin-token");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.test/api/v1/admin/site-content",
    );
  });
});
