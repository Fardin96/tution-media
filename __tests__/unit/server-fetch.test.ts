import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const API_ENV = "NEXT_PUBLIC_API_URL";
const DISABLE_ENV = "DISABLE_SERVER_PREFETCH";
const originalApi = process.env[API_ENV];
const originalDisable = process.env[DISABLE_ENV];
const API = "https://api.example.com";

type FetchInit = RequestInit & {
  next?: { revalidate: number; tags: string[] };
};

// API_URL is read at import time in @/lib/api, so each case re-imports with its own env.
async function loadPublicApiGet(apiUrl: string) {
  vi.resetModules();
  vi.stubEnv(API_ENV, apiUrl);
  return (await import("@/lib/server-fetch")).publicApiGet;
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const OPTIONS = { revalidate: 300, tags: ["tutors", "zone:dhaka"] };

describe("publicApiGet", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env[DISABLE_ENV];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    if (originalApi === undefined) delete process.env[API_ENV];
    else process.env[API_ENV] = originalApi;
    if (originalDisable === undefined) delete process.env[DISABLE_ENV];
    else process.env[DISABLE_ENV] = originalDisable;
  });

  it("skips the request when DISABLE_SERVER_PREFETCH=1", async () => {
    const publicApiGet = await loadPublicApiGet(API);
    vi.stubEnv(DISABLE_ENV, "1");
    const result = await publicApiGet("/api/v1/tutors", OPTIONS);
    expect(result).toEqual({ ok: false, status: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["", "/api-proxy"])(
    "skips the request when the API URL is not absolute (%j)",
    async (apiUrl) => {
      const publicApiGet = await loadPublicApiGet(apiUrl);
      const result = await publicApiGet("/api/v1/tutors", OPTIONS);
      expect(result).toEqual({ ok: false, status: null });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("returns the parsed body on 200", async () => {
    const publicApiGet = await loadPublicApiGet(API);
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [{ id: "t1" }] }));
    const result = await publicApiGet<{ items: { id: string }[] }>(
      "/api/v1/tutors",
      OPTIONS,
    );
    expect(result).toEqual({ ok: true, data: { items: [{ id: "t1" }] } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/api/v1/tutors`);
  });

  it("returns the status on 404", async () => {
    const publicApiGet = await loadPublicApiGet(API);
    fetchMock.mockResolvedValue(jsonResponse(404, { code: "NOT_FOUND" }));
    const result = await publicApiGet("/api/v1/tutors/x", OPTIONS);
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it("returns status null when fetch throws", async () => {
    const publicApiGet = await loadPublicApiGet(API);
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const result = await publicApiGet("/api/v1/tutors", OPTIONS);
    expect(result).toEqual({ ok: false, status: null });
  });

  it("sends no credentials and passes next exactly", async () => {
    const publicApiGet = await loadPublicApiGet(API);
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await publicApiGet("/api/v1/tutors", OPTIONS);
    const [, init] = fetchMock.mock.calls[0] as [string, FetchInit];
    const headerNames = Object.keys(init.headers as Record<string, string>).map(
      (name) => name.toLowerCase(),
    );
    expect(headerNames).not.toContain("authorization");
    expect(headerNames).not.toContain("cookie");
    expect(init.credentials).toBeUndefined();
    expect(init.next).toStrictEqual({
      revalidate: 300,
      tags: ["tutors", "zone:dhaka"],
    });
  });
});
