import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MediaField } from "@/components/admin/site-content/fields";
import {
  SiteMediaContext,
  useSiteMediaStore,
} from "@/components/admin/site-content/media";
import type { MediaMap } from "@/lib/admin-site-content";
import { MEDIA_GUIDES, type MediaSlot } from "@/lib/site-media-guides";
import { started, uploadedAsset } from "./support/upload-fake";

vi.mock("@/lib/files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/files")>();
  const fake = await import("./support/upload-fake");
  return { ...actual, ...fake.fakeFileUploadModule(actual.checkFile) };
});

const SLOTS: MediaSlot[] = [
  "testimonialPhoto",
  "showcasePoster",
  "showcaseVideo",
  "howItWorksPoster",
  "howItWorksVideo",
];

const FILE_ID = "9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const SHIPPED_PHOTO = "/assets/avatar-demo/tutor/tutor1.png";

/** MediaField inside the real store and context, the way the editor mounts it. */
function Harness({
  slot,
  initial = "",
  media = {},
  error,
  onValue,
}: {
  slot: MediaSlot;
  initial?: string;
  media?: MediaMap;
  error?: string;
  onValue?: (next: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const { state } = useSiteMediaStore(media, { photo: value });
  return (
    <SiteMediaContext.Provider value={state}>
      <MediaField
        slot={slot}
        label="Photo"
        value={value}
        error={error}
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
      />
    </SiteMediaContext.Provider>
  );
}

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;

beforeEach(() => {
  started.length = 0;
  let count = 0;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => `blob:preview-${++count}`),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: originalCreate,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: originalRevoke,
  });
  vi.unstubAllGlobals();
});

describe("MediaField guidance", () => {
  it.each(SLOTS)("shows the guidance for %s", (slot) => {
    render(<Harness slot={slot} />);
    const guide = MEDIA_GUIDES[slot];
    expect(screen.getByText(guide.shape)).toBeInTheDocument();
    expect(screen.getByText(guide.crop)).toBeInTheDocument();
    const hint =
      guide.kind === "image"
        ? "JPG, PNG or WebP, up to 5 MB."
        : "MP4 or WebM, up to 25 MB.";
    expect(screen.getByText(hint)).toBeInTheDocument();
  });

  it("links the guidance to the upload control through aria-describedby", () => {
    const { container } = render(<Harness slot="testimonialPhoto" />);
    const guide = container.querySelector<HTMLElement>("[id$='-guide']");
    const picker = screen
      .getByRole("button", { name: "Choose an image" })
      .closest<HTMLElement>("[aria-describedby]");
    expect(guide).not.toBeNull();
    expect(picker?.getAttribute("aria-describedby")).toContain(guide!.id);
  });

  it("shows the error under the control", () => {
    render(
      <Harness
        slot="testimonialPhoto"
        error="This file is gone or not finished uploading. Upload it again."
      />,
    );
    expect(
      screen.getByText(
        "This file is gone or not finished uploading. Upload it again.",
      ),
    ).toBeInTheDocument();
  });
});

describe("MediaField source", () => {
  it("starts on the choice that matches the value", () => {
    const { unmount } = render(
      <Harness slot="testimonialPhoto" initial={SHIPPED_PHOTO} />,
    );
    expect(
      screen.getByRole("radio", { name: "Use a built-in file" }),
    ).toBeChecked();
    unmount();
    render(
      <Harness
        slot="testimonialPhoto"
        initial={`file:${FILE_ID}`}
        media={{
          [FILE_ID]: {
            url: "https://cdn.example.com/a.png",
            contentType: "image/png",
            originalName: "a.png",
          },
        }}
      />,
    );
    expect(screen.getByRole("radio", { name: "Upload a file" })).toBeChecked();
  });

  it("offers the link choice for video, not for a photo", () => {
    const { unmount } = render(<Harness slot="showcaseVideo" />);
    expect(
      screen.getByRole("radio", { name: "Other link" }),
    ).toBeInTheDocument();
    unmount();
    render(<Harness slot="testimonialPhoto" />);
    expect(
      screen.queryByRole("radio", { name: "Other link" }),
    ).not.toBeInTheDocument();
  });

  it("picking a built-in file sets its path", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness slot="testimonialPhoto" onValue={onValue} />);
    await user.click(
      screen.getByRole("radio", { name: "Use a built-in file" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Built-in image"),
      SHIPPED_PHOTO,
    );
    expect(onValue).toHaveBeenLastCalledWith(SHIPPED_PHOTO);
    expect(screen.getByText("Built-in: tutor1.png")).toBeInTheDocument();
  });

  it("a built-in video shows a muted player with controls", () => {
    const { container } = render(
      <Harness slot="showcaseVideo" initial="/videos/tutor1.mp4" />,
    );
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video!.muted).toBe(true);
  });
});

describe("MediaField upload", () => {
  it("a finished upload sets file:<id> and shows the thumbnail", async () => {
    const { container } = render(<Harness slot="testimonialPhoto" />);
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["png"], "photo.png", { type: "image/png" });
    await userEvent.upload(input, file);
    await waitFor(() => expect(started).toHaveLength(1));
    await act(async () => {
      started[0].finish(uploadedAsset({ id: FILE_ID }));
    });
    expect(await screen.findByText("Uploaded: photo.png")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "blob:preview-1",
    );
  });

  it("shows the thumbnail from the saved media for an uploaded value", () => {
    const { container } = render(
      <Harness
        slot="testimonialPhoto"
        initial={`file:${FILE_ID}`}
        media={{
          [FILE_ID]: {
            url: "https://cdn.example.com/saved.png",
            contentType: "image/png",
            originalName: "saved.png",
          },
        }}
      />,
    );
    expect(screen.getByText("Uploaded: saved.png")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example.com/saved.png",
    );
  });

  it("warns about a small image without blocking the upload", async () => {
    class SmallImage {
      naturalWidth = 400;
      naturalHeight = 300;
      onload: (() => void) | null = null;
      set src(_url: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", SmallImage);
    const onValue = vi.fn();
    const { container } = render(
      <Harness slot="howItWorksPoster" onValue={onValue} />,
    );
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.upload(
      input,
      new File(["png"], "small.png", { type: "image/png" }),
    );
    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent(
      "This file is 400 × 300 px, smaller than the 1280 × 720 px we suggest.",
    );
    expect(onValue).not.toHaveBeenCalled();
    expect(started).toHaveLength(1);
  });

  it("refuses a file of the wrong type before any upload", async () => {
    const { container } = render(<Harness slot="testimonialPhoto" />);
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    // userEvent applies `accept`, so the wrong type is set on the input directly.
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["x"], "doc.pdf", { type: "application/pdf" })],
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(
      await screen.findByText("Use JPG, PNG or WebP, up to 5 MB."),
    ).toBeInTheDocument();
    expect(started).toHaveLength(0);
  });
});
