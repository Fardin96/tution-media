import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, getStoredTokens } from "@/lib/api";
import { refreshSiteContent } from "@/lib/site-content.actions";
import {
  useRemoveFile,
  canRemoveFile,
  PURPOSE_LABEL,
  removeFileText,
  showUnverifyOption,
  summarizeStats,
  type AdminFile,
  type AdminFileStatsGroup,
} from "@/lib/admin-files";

function file(overrides: Partial<AdminFile> = {}): AdminFile {
  return {
    id: "f1",
    purpose: "TUTOR_ID",
    contentType: "application/pdf",
    sizeBytes: 10,
    status: "UPLOADED",
    fileName: "id.pdf",
    createdAt: "2026-11-01T00:00:00.000Z",
    uploadedAt: "2026-11-01T00:00:00.000Z",
    ownerAccountId: "acc-1",
    ownerEmail: "a@example.com",
    published: false,
    inUse: true,
    ...overrides,
  };
}

describe("canRemoveFile", () => {
  it("allows removing an uploaded file that a record uses", () => {
    expect(canRemoveFile(file())).toBe(true);
    expect(canRemoveFile(file({ purpose: "TUTOR_VIDEO" }))).toBe(true);
  });

  it("refuses unused, pending, deleted and blog cover files", () => {
    expect(canRemoveFile(file({ inUse: false }))).toBe(false);
    expect(canRemoveFile(file({ status: "PENDING_UPLOAD" }))).toBe(false);
    expect(canRemoveFile(file({ status: "DELETED" }))).toBe(false);
    expect(canRemoveFile(file({ purpose: "BLOG_COVER" }))).toBe(false);
  });

  it("refuses site images and videos, which the admin replaces in Site content", () => {
    expect(canRemoveFile(file({ purpose: "SITE_IMAGE" }))).toBe(false);
    expect(canRemoveFile(file({ purpose: "SITE_VIDEO" }))).toBe(false);
  });
});

describe("showUnverifyOption", () => {
  it("offers the box only for an approved ID", () => {
    expect(
      showUnverifyOption({
        fileId: "f",
        fileName: null,
        purpose: "TUTOR_ID",
        idStatus: "APPROVED",
      }),
    ).toBe(true);
    expect(
      showUnverifyOption({
        fileId: "f",
        fileName: null,
        purpose: "STUDENT_ID",
        idStatus: "APPROVED",
      }),
    ).toBe(true);
  });

  it("hides the box for other statuses, unknown status and other files", () => {
    expect(
      showUnverifyOption({
        fileId: "f",
        fileName: null,
        purpose: "TUTOR_ID",
        idStatus: "PENDING",
      }),
    ).toBe(false);
    expect(
      showUnverifyOption({ fileId: "f", fileName: null, purpose: "TUTOR_ID" }),
    ).toBe(false);
    expect(
      showUnverifyOption({
        fileId: "f",
        fileName: null,
        purpose: "CREDENTIAL",
        idStatus: "APPROVED",
      }),
    ).toBe(false);
  });
});

describe("removeFileText", () => {
  it("says what happens for each purpose", () => {
    expect(
      removeFileText({ fileId: "f", fileName: null, purpose: "TUTOR_VIDEO" }),
    ).toBe("The video is deleted from their profile.");
    expect(
      removeFileText({ fileId: "f", fileName: null, purpose: "CREDENTIAL" }),
    ).toBe("The certificate is deleted from their profile.");
    expect(
      removeFileText({
        fileId: "f",
        fileName: null,
        purpose: "TUTOR_ID",
        idStatus: "PENDING",
      }),
    ).toBe("The ID is rejected and the user can upload a new one.");
  });

  it("explains an unknown ID status without promising a rejection", () => {
    const text = removeFileText({
      fileId: "f",
      fileName: null,
      purpose: "STUDENT_ID",
    });
    expect(text).toContain("A pending ID is rejected");
    expect(text).toContain("An approved ID stays verified");
  });
});

describe("PURPOSE_LABEL", () => {
  it("has a readable label for every purpose", () => {
    expect(PURPOSE_LABEL).toEqual({
      STUDENT_ID: "Student ID",
      TUTOR_ID: "Tutor ID",
      CREDENTIAL: "Credential",
      TUTOR_VIDEO: "Video",
      BLOG_COVER: "Blog cover",
      SITE_IMAGE: "Site image",
      SITE_VIDEO: "Site video",
      STORY_IMAGE: "Story photo",
      STORY_VIDEO: "Story video",
    });
  });
});

describe("summarizeStats", () => {
  it("returns one row per purpose in order, with zeros when there are no groups", () => {
    const rows = summarizeStats([]);
    expect(rows.map((row) => row.purpose)).toEqual([
      "STUDENT_ID",
      "TUTOR_ID",
      "CREDENTIAL",
      "TUTOR_VIDEO",
      "BLOG_COVER",
      "SITE_IMAGE",
      "SITE_VIDEO",
      "STORY_IMAGE",
      "STORY_VIDEO",
    ]);
    expect(rows.every((row) => row.uploadedCount === 0)).toBe(true);
    expect(rows.every((row) => row.uploadedBytes === 0)).toBe(true);
  });

  it("counts and sizes only UPLOADED files, and counts pending and deleted apart", () => {
    const groups: AdminFileStatsGroup[] = [
      { purpose: "TUTOR_VIDEO", status: "UPLOADED", count: 3, totalBytes: 300 },
      {
        purpose: "TUTOR_VIDEO",
        status: "PENDING_UPLOAD",
        count: 2,
        totalBytes: 999,
      },
      { purpose: "TUTOR_VIDEO", status: "DELETED", count: 4, totalBytes: 500 },
      { purpose: "BLOG_COVER", status: "UPLOADED", count: 1, totalBytes: 50 },
    ];
    const video = summarizeStats(groups).find(
      (r) => r.purpose === "TUTOR_VIDEO",
    );
    expect(video).toEqual({
      purpose: "TUTOR_VIDEO",
      label: "Video",
      uploadedCount: 3,
      uploadedBytes: 300,
      pendingCount: 2,
      deletedCount: 4,
    });
    const cover = summarizeStats(groups).find(
      (r) => r.purpose === "BLOG_COVER",
    );
    expect(cover?.uploadedCount).toBe(1);
    expect(cover?.uploadedBytes).toBe(50);
    expect(cover?.pendingCount).toBe(0);
  });

  it("does not mix purposes", () => {
    const rows = summarizeStats([
      { purpose: "STUDENT_ID", status: "UPLOADED", count: 5, totalBytes: 10 },
    ]);
    expect(rows.find((r) => r.purpose === "TUTOR_ID")?.uploadedCount).toBe(0);
    expect(rows.find((r) => r.purpose === "STUDENT_ID")?.uploadedCount).toBe(5);
  });
});

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
  getStoredTokens: vi.fn(),
}));

vi.mock("@/lib/site-content.actions", () => ({
  refreshSiteContent: vi.fn(),
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function renderRemoveFile() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  }
  return renderHook(() => useRemoveFile(), { wrapper: Wrapper });
}

const REMOVE = {
  fileId: "file-1",
  body: { note: "Blurred ID" },
} as const;

describe("useRemoveFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStoredTokens).mockReturnValue({
      accessToken: "admin-1",
      refreshToken: "refresh-1",
    });
    vi.mocked(apiFetch).mockResolvedValue(json(200, {}));
    vi.mocked(refreshSiteContent).mockResolvedValue(true);
  });

  it("expires the landing cache with the admin's token after a removal", async () => {
    const { result } = renderRemoveFile();

    await act(() => result.current.mutateAsync(REMOVE));

    await waitFor(() =>
      expect(refreshSiteContent).toHaveBeenCalledWith("admin-1"),
    );
  });

  it("does not touch the landing when nobody is signed in", async () => {
    vi.mocked(getStoredTokens).mockReturnValue(null);
    const { result } = renderRemoveFile();

    await act(() => result.current.mutateAsync(REMOVE));

    expect(refreshSiteContent).not.toHaveBeenCalled();
  });

  it("does not touch the landing when the removal fails", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(409, { error: "Conflict" }));
    const { result } = renderRemoveFile();

    await act(async () => {
      await expect(result.current.mutateAsync(REMOVE)).rejects.toBeDefined();
    });

    expect(refreshSiteContent).not.toHaveBeenCalled();
  });

  it("still reports the removal as done when the landing refresh fails", async () => {
    vi.mocked(refreshSiteContent).mockRejectedValue(
      new TypeError("fetch failed"),
    );
    const { result } = renderRemoveFile();

    await act(async () => {
      await expect(result.current.mutateAsync(REMOVE)).resolves.toBeDefined();
    });
    await waitFor(() => expect(refreshSiteContent).toHaveBeenCalledTimes(1));
  });
});
