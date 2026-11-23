import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { AvatarDialog } from "@/components/profile/avatar-dialog";
import { apiFetch, getStoredTokens } from "@/lib/api";
import type { FileAsset, FilePurpose, UploadState } from "@/lib/files";
import { queryKeys } from "@/lib/query-keys";
import { refreshMyTutorProfile } from "@/lib/tutor-profile.actions";
import { uploadedAsset } from "./support/upload-fake";

// Every upload the dialog starts, with the purpose it asked for. finish() completes one.
const uploads = vi.hoisted(
  () =>
    [] as {
      purpose: FilePurpose;
      file: File;
      finish: (asset: FileAsset | null) => void;
    }[],
);

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
  getStoredTokens: vi.fn(() => null),
}));

vi.mock("@/lib/tutor-profile.actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tutor-profile.actions")>()),
  refreshMyTutorProfile: vi.fn(async () => true),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/files")>();
  const { useCallback, useRef, useState } = await import("react");
  return {
    ...actual,
    useFileUpload(purpose: FilePurpose) {
      const [state, setState] = useState<UploadState>({ status: "idle" });
      const pending = useRef<((asset: FileAsset | null) => void)[]>([]);
      return {
        state,
        start(file: File): Promise<FileAsset | null> {
          const problem = actual.checkFile(purpose, file);
          if (problem) {
            setState({ status: "error", message: problem });
            return Promise.resolve(null);
          }
          setState({ status: "uploading", fileName: file.name, progress: 0 });
          return new Promise((resolve) => {
            const finish = (asset: FileAsset | null) => {
              setState(
                asset ? { status: "done", file: asset } : { status: "idle" },
              );
              resolve(asset);
            };
            pending.current.push(finish);
            uploads.push({ purpose, file, finish });
          });
        },
        // Like the real hook, an abort ends the pending start with null.
        cancel: useCallback(() => {
          for (const finish of pending.current.splice(0)) finish(null);
          setState({ status: "idle" });
        }, []),
        reset: useCallback(() => setState({ status: "idle" }), []),
        refuse: (message: string) => setState({ status: "error", message }),
      };
    },
  };
});

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  "photo.jpg": { width: 800, height: 600 },
  "tiny.png": { width: 100, height: 100 },
};

const UNSUPPORTED =
  "This photo format isn't supported. Choose a JPG, PNG or WebP.";
const SMALL = "Choose a photo at least 128 × 128 pixels.";
const R2_AVATAR = "https://pub-test.r2.dev/avatars/nadia.webp";
const GOOGLE_AVATAR = "https://lh3.googleusercontent.com/a/picture=s96-c";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const UPLOAD_STATUS: {
  blocksVideos: boolean;
  blocksDocuments: boolean;
  note: string | null;
  blockedAt: string | null;
} = {
  blocksVideos: false,
  blocksDocuments: false,
  note: null,
  blockedAt: null,
};

/** Every request the dialog sent through apiFetch: method, path and parsed body. */
function sentRequests() {
  return vi.mocked(apiFetch).mock.calls.map(([url, init]) => ({
    method: String(init?.method ?? "GET"),
    path: new URL(String(url)).pathname,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }));
}

function api({
  status = UPLOAD_STATUS,
  put = () => json(200, { avatarUrl: R2_AVATAR }),
  del = () => json(200, { avatarUrl: null }),
}: {
  status?: typeof UPLOAD_STATUS;
  put?: () => Response;
  del?: () => Response;
}) {
  vi.mocked(apiFetch).mockImplementation(async (url, init) => {
    const { pathname } = new URL(String(url));
    if (pathname === "/api/v1/files/upload-status") return json(200, status);
    if (pathname === "/api/v1/me/avatar" && init?.method === "PUT")
      return put();
    if (pathname === "/api/v1/me/avatar" && init?.method === "DELETE")
      return del();
    return json(404, { error: "NotFound", code: "NOT_FOUND", message: "x" });
  });
}

let webpSupported = true;

beforeEach(() => {
  uploads.length = 0;
  vi.mocked(getStoredTokens).mockReturnValue(null);
  vi.mocked(refreshMyTutorProfile).mockClear();
  vi.mocked(apiFetch).mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  webpSupported = true;
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (file: File) => {
      const dims = DIMENSIONS[file.name];
      if (!dims) throw new DOMException("Unsupported", "InvalidStateError");
      return { ...dims, close: vi.fn() };
    }),
  );
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  })) as unknown as HTMLCanvasElement["getContext"];
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (
    callback: BlobCallback,
    type?: string,
  ) {
    if (type === "image/webp" && !webpSupported) return callback(null);
    callback(new Blob(["pixels"], { type: type ?? "image/png" }));
  });
  URL.createObjectURL = vi.fn(() => "blob:avatar-preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderDialog(props: Partial<Parameters<typeof AvatarDialog>[0]> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = vi.fn();
  const onChanged = vi.fn();
  const base = {
    open: true,
    onOpenChange,
    onChanged,
    role: "STUDENT" as const,
    avatarUrl: null,
    name: "Nadia Islam",
    tutorId: null,
    ...props,
  };
  const ui = (next: typeof base) => (
    <QueryClientProvider client={client}>
      <AvatarDialog {...next} />
    </QueryClientProvider>
  );
  const view = render(ui(base));
  return {
    client,
    onOpenChange,
    onChanged,
    setOpen: (open: boolean) => view.rerender(ui({ ...base, open })),
  };
}

/** Picks a photo, waits until it is ready, and clicks Save. The upload then waits in `uploads`. */
async function pickAndSave(file = photo("photo.jpg")) {
  await pick(file);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save photo" })).toBeEnabled(),
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save photo" }));
  await waitFor(() => expect(uploads).toHaveLength(1));
}

function picker() {
  return screen.getByLabelText("New photo") as HTMLInputElement;
}

async function pick(file: File) {
  const user = userEvent.setup();
  await user.upload(picker(), file);
}

const photo = (name: string, type = "image/jpeg") =>
  new File(["bytes"], name, { type });

describe("AvatarDialog", () => {
  it("refuses a photo the browser cannot decode, with the message tied to the input", async () => {
    api({});
    renderDialog();
    await pick(photo("holiday.heic", "image/heic"));

    expect(await screen.findByText(UNSUPPORTED)).toBeInTheDocument();
    expect(picker()).toHaveAccessibleDescription(
      expect.stringContaining(UNSUPPORTED),
    );
    expect(screen.getByRole("button", { name: "Save photo" })).toBeDisabled();
  });

  it("refuses a photo under 128 pixels on either side", async () => {
    api({});
    renderDialog();
    await pick(photo("tiny.png", "image/png"));

    expect(await screen.findByText(SMALL)).toBeInTheDocument();
    expect(picker()).toHaveAccessibleDescription(
      expect.stringContaining(SMALL),
    );
  });

  it("uploads the cropped square as AVATAR, then sets it, and toasts", async () => {
    api({});
    const { onOpenChange, onChanged } = renderDialog();
    await pick(photo("photo.jpg"));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save photo" })).toBeEnabled(),
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Save photo" }));

    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0].purpose).toBe("AVATAR");
    expect(uploads[0].file.name).toBe("avatar.webp");
    expect(uploads[0].file.type).toBe("image/webp");

    uploads[0].finish(
      uploadedAsset({ id: "file-avatar-1", purpose: "AVATAR" }),
    );

    await waitFor(() =>
      expect(sentRequests()).toContainEqual({
        method: "PUT",
        path: "/api/v1/me/avatar",
        body: { fileId: "file-avatar-1" },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Profile picture updated");
    expect(onChanged).toHaveBeenCalledWith(R2_AVATAR);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("encodes a JPEG when the browser cannot produce WebP", async () => {
    webpSupported = false;
    api({});
    renderDialog();
    await pick(photo("photo.jpg"));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save photo" })).toBeEnabled(),
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Save photo" }));

    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0].file.name).toBe("avatar.jpg");
    expect(uploads[0].file.type).toBe("image/jpeg");
  });

  it("never sets a photo that finishes after the dialog closed", async () => {
    api({});
    const { setOpen } = renderDialog();
    await pick(photo("photo.jpg"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save photo" })).toBeEnabled(),
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Save photo" }));
    await waitFor(() => expect(uploads).toHaveLength(1));

    setOpen(false);
    await act(async () =>
      uploads[0].finish(uploadedAsset({ id: "late-file", purpose: "AVATAR" })),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sentRequests().some((r) => r.method === "PUT")).toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("removes the uploaded photo through DELETE", async () => {
    api({});
    const { onOpenChange, onChanged } = renderDialog({ avatarUrl: R2_AVATAR });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Remove photo" }));

    await waitFor(() =>
      expect(sentRequests()).toContainEqual({
        method: "DELETE",
        path: "/api/v1/me/avatar",
        body: undefined,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Profile picture removed");
    expect(onChanged).toHaveBeenCalledWith(null);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not offer Remove for the Google picture, which is not an upload", () => {
    api({});
    renderDialog({ avatarUrl: GOOGLE_AVATAR });
    expect(
      screen.queryByRole("button", { name: "Remove photo" }),
    ).not.toBeInTheDocument();
  });

  it("shows the paused notice instead of the picker, and still lets the photo go", async () => {
    api({
      status: { ...UPLOAD_STATUS, blocksDocuments: true, note: "Check it." },
    });
    renderDialog({ avatarUrl: R2_AVATAR });

    expect(
      await screen.findByText(
        "An admin paused your ID, certificate and photo uploads.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Admin note: Check it.")).toBeInTheDocument();
    expect(screen.queryByLabelText("New photo")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove photo" }),
    ).toBeInTheDocument();
  });

  it("says where a tutor's photo shows", () => {
    api({});
    renderDialog({ role: "TUTOR", tutorId: "tutor-1" });
    expect(
      screen.getByText(
        "Your photo shows on your tutor page, in search results and on your applications.",
      ),
    ).toBeInTheDocument();
  });

  it("says where a student's photo shows, without claiming the tutor page", () => {
    api({});
    renderDialog({ role: "STUDENT" });
    expect(
      screen.getByText("Your photo shows to tutors on your applications."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/tutor page/)).not.toBeInTheDocument();
  });

  it("refreshes the tutor's public profile after a save", async () => {
    vi.mocked(getStoredTokens).mockReturnValue({
      accessToken: "tok",
    } as unknown as ReturnType<typeof getStoredTokens>);
    api({});
    const { client } = renderDialog({ role: "TUTOR", tutorId: "tutor-1" });
    const invalidate = vi.spyOn(client, "invalidateQueries");

    await pickAndSave();
    uploads[0].finish(
      uploadedAsset({ id: "file-avatar-2", purpose: "AVATAR" }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Profile picture updated"),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.tutors.profile("tutor-1"),
    });
    expect(refreshMyTutorProfile).toHaveBeenCalledWith("tok");
  });

  it("announces when the photo is ready, from a status line that is always there", async () => {
    api({});
    renderDialog();
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();

    await pick(photo("photo.jpg"));
    await waitFor(() =>
      expect(status).toHaveTextContent("Photo ready. Save to use it."),
    );
    expect(screen.getByRole("status")).toBe(status);
  });

  it("drops the unsaved preview when the save is refused", async () => {
    api({
      put: () =>
        json(403, {
          error: "Forbidden",
          code: "UPLOADS_BLOCKED",
          message: "Uploads are paused.",
        }),
    });
    renderDialog({ avatarUrl: R2_AVATAR });
    await pickAndSave();
    expect(
      document.querySelector('img[src="blob:avatar-preview"]'),
    ).toBeInTheDocument();

    uploads[0].finish(
      uploadedAsset({ id: "file-avatar-3", purpose: "AVATAR" }),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(
      document.querySelector('img[src="blob:avatar-preview"]'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save photo" })).toBeDisabled();
  });

  it("keeps Cancel enabled while the photo uploads, since closing aborts the upload", async () => {
    api({});
    renderDialog();
    await pickAndSave();

    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("puts Remove photo at the start of the action row, before Cancel", () => {
    api({});
    renderDialog({ avatarUrl: R2_AVATAR });
    const remove = screen.getByRole("button", { name: "Remove photo" });
    const cancel = screen.getByRole("button", { name: "Cancel" });

    expect(
      remove.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
