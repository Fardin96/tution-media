import { describe, it, expect, vi, beforeEach } from "vitest";
import { areaApi, clearAreaCache, loadAreas } from "@/lib/areas";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const LIST = {
  divisions: [
    {
      name: "Dhaka",
      districts: [
        {
          code: "dhaka",
          name: "Dhaka",
          areas: [
            { id: 1, name: "Dhanmondi" },
            { id: 2, name: "Gulshan" },
          ],
        },
        {
          code: "gazipur",
          name: "Gazipur",
          areas: [{ id: 3, name: "Tongi" }],
        },
      ],
    },
    {
      name: "Chattogram",
      districts: [
        {
          code: null,
          name: "Cox's Bazar",
          areas: [{ id: 4, name: "Cox's Bazar Sadar" }],
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  clearAreaCache();
});

describe("areaApi.list", () => {
  it("flattens divisions and districts into {id, name} options in order", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(200, LIST));

    await expect(areaApi.list()).resolves.toEqual([
      { id: 1, name: "Dhanmondi" },
      { id: 2, name: "Gulshan" },
      { id: 3, name: "Tongi" },
      { id: 4, name: "Cox's Bazar Sadar" },
    ]);
    const [url] = vi.mocked(apiFetch).mock.calls[0];
    expect(new URL(String(url), "http://localhost").pathname).toBe(
      "/api/v1/areas",
    );
  });

  it("returns an empty list when no district has areas", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      json(200, {
        divisions: [
          { name: "Dhaka", districts: [{ code: null, name: "X", areas: [] }] },
        ],
      }),
    );

    await expect(areaApi.list()).resolves.toEqual([]);
  });
});

describe("loadAreas", () => {
  it("shares one request between callers until the cache is cleared", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => json(200, LIST));

    const [first, second] = await Promise.all([loadAreas(), loadAreas()]);
    expect(first).toEqual(second);
    expect(first).toHaveLength(4);
    await loadAreas();
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);

    clearAreaCache();
    await loadAreas();
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(2);
  });

  it("retries after a failed load instead of caching the failure", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(json(500, { error: "Error", message: "boom" }))
      .mockResolvedValueOnce(json(200, LIST));

    await expect(loadAreas()).rejects.toThrow();
    await expect(loadAreas()).resolves.toHaveLength(4);
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(2);
  });
});
