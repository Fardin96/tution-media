import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeRequest(auth?: string) {
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = auth;
  return new NextRequest("http://localhost/api/v1/me/hard-delete", {
    method: "DELETE",
    headers,
  });
}

async function loadRoute() {
  const { DELETE } = await import("@/app/api/v1/me/hard-delete/route");
  return DELETE;
}

describe("DELETE /api/v1/me/hard-delete", () => {
  it("returns 401 when the Authorization header is missing", async () => {
    const DELETE = await loadRoute();
    const res = await DELETE(makeRequest());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      message: "Your session has expired. Sign in again.",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("forwards the request to the backend with the Authorization header", async () => {
    const DELETE = await loadRoute();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const res = await DELETE(makeRequest("Bearer token-123"));

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/me/hard-delete",
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer token-123",
        },
      },
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("returns an empty 204 when the backend returns 204", async () => {
    const DELETE = await loadRoute();
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));

    const res = await DELETE(makeRequest("Bearer token-123"));

    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });

  it("forwards backend error responses", async () => {
    const DELETE = await loadRoute();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: "Already deleted" }), {
        status: 409,
      }),
    );

    const res = await DELETE(makeRequest("Bearer token-123"));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ message: "Already deleted" });
  });

  it("returns 502 when the backend is unreachable", async () => {
    const DELETE = await loadRoute();
    mockFetch.mockRejectedValue(new Error("network failure"));

    const res = await DELETE(makeRequest("Bearer token-123"));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      message: "Couldn't reach the account service. Try again in a moment.",
    });
  });
});
