import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { clearAreaCache } from "@/lib/areas";
import {
  adminAreaApi,
  useCreateArea,
  useUpdateArea,
  validateAreaName,
} from "@/lib/admin-areas";
import { queryKeys } from "@/lib/query-keys";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/areas", () => ({ clearAreaCache: vi.fn() }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const EMPTY_LIST = { areas: [], districts: [] };

const AREA = {
  id: 7,
  name: "Dhanmondi",
  division: "Dhaka",
  district: "Dhaka",
  districtCode: "dhaka",
  isActive: true,
  tutorCount: 0,
  studentCount: 0,
  requirementCount: 0,
};

/** Method, path, query and parsed body of the nth request the client sent through apiFetch. */
function sent(i: number) {
  const [url, init] = vi.mocked(apiFetch).mock.calls[i];
  const parsed = new URL(String(url));
  return {
    method: init?.method,
    path: parsed.pathname,
    search: parsed.searchParams,
    body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
  };
}

function wrapperWith(client: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  }
  return Wrapper;
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(clearAreaCache).mockClear();
});

describe("validateAreaName", () => {
  it("accepts a name of 2 to 60 characters", () => {
    expect(validateAreaName("ICT")).toBeUndefined();
    expect(validateAreaName("Hi")).toBeUndefined();
    expect(validateAreaName("a".repeat(60))).toBeUndefined();
  });

  it("trims before checking", () => {
    expect(validateAreaName("   ")).toBe("Enter an area name.");
    expect(validateAreaName("  A  ")).toBe("Use at least 2 characters.");
  });

  it("rejects a name longer than 60 characters", () => {
    expect(validateAreaName("a".repeat(61))).toBe(
      "Use 60 characters or fewer.",
    );
  });
});

describe("adminAreaApi.list", () => {
  it.each([
    ["active", "true"],
    ["inactive", "false"],
    ["all", null],
  ] as const)(
    "sends isActive for status %s as %s",
    async (status, isActive) => {
      vi.mocked(apiFetch).mockResolvedValue(json(200, EMPTY_LIST));

      await adminAreaApi.list({ status });

      const { method, path, search } = sent(0);
      expect(method).toBe("GET");
      expect(path).toBe("/api/v1/admin/areas");
      expect(search.get("isActive")).toBe(isActive);
    },
  );

  it("sends districtCode and q when set", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(200, EMPTY_LIST));

    await adminAreaApi.list({
      status: "all",
      districtCode: "dhaka",
      q: "dhan",
    });

    const { search } = sent(0);
    expect(search.get("districtCode")).toBe("dhaka");
    expect(search.get("q")).toBe("dhan");
  });

  it("leaves out an empty district and search", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(200, EMPTY_LIST));

    await adminAreaApi.list({ status: "all", districtCode: "", q: "" });

    const { search } = sent(0);
    expect(search.has("districtCode")).toBe(false);
    expect(search.has("q")).toBe(false);
  });
});

describe("adminAreaApi.create", () => {
  it("posts the district and name to the collection", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(201, AREA));

    await adminAreaApi.create({ districtCode: "dhaka", name: "Dhanmondi" });

    const request = sent(0);
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/api/v1/admin/areas");
    expect(request.body).toEqual({ districtCode: "dhaka", name: "Dhanmondi" });
  });
});

describe("adminAreaApi.update", () => {
  it("patches the area by id with only the sent fields", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(200, AREA));

    await adminAreaApi.update(7, { isActive: false });

    const request = sent(0);
    expect(request.method).toBe("PATCH");
    expect(request.path).toBe("/api/v1/admin/areas/7");
    expect(request.body).toEqual({ isActive: false });
  });

  it("sends the new name when renaming", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(200, AREA));

    await adminAreaApi.update(7, { name: "Dhanmondi 2" });

    expect(sent(0).body).toEqual({ name: "Dhanmondi 2" });
  });
});

describe("area writes", () => {
  it("create clears the public area cache and refreshes both lists", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(201, AREA));
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateArea(), {
      wrapper: wrapperWith(client),
    });
    await result.current.mutateAsync({
      districtCode: "dhaka",
      name: "Dhanmondi",
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    expect(clearAreaCache).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.admin.areasAll,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.areas });
  });

  it("update clears the public area cache and refreshes both lists", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(200, AREA));
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useUpdateArea(), {
      wrapper: wrapperWith(client),
    });
    await result.current.mutateAsync({ id: 7, body: { isActive: false } });

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    expect(clearAreaCache).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.admin.areasAll,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.areas });
  });
});
