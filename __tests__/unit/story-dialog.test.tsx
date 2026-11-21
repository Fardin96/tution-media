import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { StoryDialog } from "@/components/stories/story-dialog";
import { apiFetch } from "@/lib/api";
import { uploadedAsset, started } from "./support/upload-fake";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/files")>();
  const fake = await import("./support/upload-fake");
  return { ...actual, ...fake.fakeFileUploadModule(actual.checkFile) };
});

const IMAGE_ID = "9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const CONSENT_LABEL = "Masters Hub may show this on its website with my name.";

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

/** The requests the dialog sent through apiFetch, method and parsed body. */
function sentRequests() {
  return vi.mocked(apiFetch).mock.calls.map(([url, init]) => ({
    method: String(init?.method ?? "GET"),
    path: new URL(String(url)).pathname,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }));
}

function api(
  status: typeof UPLOAD_STATUS,
  createResponse: () => Response = () => json(201, {}),
) {
  vi.mocked(apiFetch).mockImplementation(async (url, init) => {
    const { pathname } = new URL(String(url));
    if (pathname === "/api/v1/files/upload-status") return json(200, status);
    if (pathname === "/api/v1/me/stories" && init?.method === "POST")
      return createResponse();
    return json(404, { error: "NotFound", code: "NOT_FOUND", message: "x" });
  });
}

function renderDialog(role: "STUDENT" | "TUTOR") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <StoryDialog open onOpenChange={onOpenChange} role={role} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

/** Picks a file in the nth file picker and waits for the fake upload to start. */
async function pickFile(container: HTMLElement, index: number, name: string) {
  const inputs =
    container.querySelectorAll<HTMLInputElement>('input[type="file"]');
  const type = name.endsWith(".mp4") ? "video/mp4" : "image/png";
  await userEvent.upload(inputs[index], new File(["bytes"], name, { type }));
  await waitFor(() => expect(started.length).toBeGreaterThan(0));
  return started[started.length - 1];
}

beforeEach(() => {
  started.length = 0;
  vi.mocked(apiFetch).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

afterEach(() => {
  started.length = 0;
});

describe("StoryDialog for students", () => {
  it("blocks submit without consent and shows the error inline", async () => {
    api(UPLOAD_STATUS);
    renderDialog("STUDENT");

    await userEvent.type(
      screen.getByLabelText("Headline"),
      "Ana passed her SSC",
    );
    await userEvent.type(
      screen.getByLabelText("Your story"),
      "We met twice a week.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Send for review" }),
    );

    expect(
      await screen.findByText("Tick the box to agree before sending."),
    ).toBeInTheDocument();
    expect(sentRequests().some((r) => r.method === "POST")).toBe(false);
  });

  it("POSTs the headline, body, photo and consent", async () => {
    api(UPLOAD_STATUS);
    const { onOpenChange } = renderDialog("STUDENT");

    await userEvent.type(
      screen.getByLabelText("Headline"),
      "Ana passed her SSC",
    );
    await userEvent.type(
      screen.getByLabelText("Your story"),
      "We met twice a week.",
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: CONSENT_LABEL }),
    );

    const photo = await pickFile(document.body, 0, "photo.png");
    await act(async () => {
      photo.finish(uploadedAsset({ id: IMAGE_ID, purpose: "STORY_IMAGE" }));
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Send for review" }),
    );

    await waitFor(() =>
      expect(sentRequests().find((r) => r.method === "POST")?.body).toEqual({
        headline: "Ana passed her SSC",
        body: "We met twice a week.",
        imageFileId: IMAGE_ID,
        consent: true,
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Story sent for review"),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a 409 STORY_PENDING message inside the dialog", async () => {
    api(UPLOAD_STATUS, () =>
      json(409, {
        error: "StoryPending",
        code: "STORY_PENDING",
        message: "Wait until your story is reviewed before sending another.",
      }),
    );
    renderDialog("STUDENT");

    await userEvent.type(
      screen.getByLabelText("Headline"),
      "Ana passed her SSC",
    );
    await userEvent.type(
      screen.getByLabelText("Your story"),
      "We met twice a week.",
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: CONSENT_LABEL }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Send for review" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wait until your story is reviewed before sending another.",
    );
  });

  it("hides the video picker while video uploads are paused", async () => {
    api({ ...UPLOAD_STATUS, blocksVideos: true, note: "Try later." });
    renderDialog("STUDENT");

    expect(
      await screen.findByText("An admin paused your video uploads."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Video (optional)")).not.toBeInTheDocument();
    expect(screen.getByText("Photo (optional)")).toBeInTheDocument();
  });
});

describe("StoryDialog for tutors", () => {
  it("has no headline or video fields", async () => {
    api(UPLOAD_STATUS);
    renderDialog("TUTOR");

    expect(screen.getByLabelText("Your story")).toBeInTheDocument();
    expect(screen.queryByLabelText("Headline")).not.toBeInTheDocument();
    expect(screen.queryByText("Video (optional)")).not.toBeInTheDocument();
    expect(document.body.querySelectorAll('input[type="file"]')).toHaveLength(
      1,
    );
  });

  it("sends a body and consent only", async () => {
    api(UPLOAD_STATUS);
    renderDialog("TUTOR");

    await userEvent.type(screen.getByLabelText("Your story"), "I teach maths.");
    await userEvent.click(
      screen.getByRole("checkbox", { name: CONSENT_LABEL }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Send for review" }),
    );

    await waitFor(() =>
      expect(sentRequests().find((r) => r.method === "POST")?.body).toEqual({
        body: "I teach maths.",
        consent: true,
      }),
    );
  });
});
