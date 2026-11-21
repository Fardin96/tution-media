import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SiteContentPage } from "@/components/admin/site-content-page";
import { ListEditor, TextInput } from "@/components/admin/site-content/fields";
import {
  BLOCK_META,
  cardFromSource,
  type AdminSiteContentItem,
  type AdminSiteSource,
} from "@/lib/admin-site-content";
import { apiFetch } from "@/lib/api";
import { refreshSiteContent } from "@/lib/site-content.actions";
import { SITE_CONTENT_DEFAULTS, type SiteContent } from "@/lib/site-content";
import { toast } from "sonner";
import { started, uploadedAsset } from "./support/upload-fake";

vi.mock("@/lib/files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/files")>();
  const fake = await import("./support/upload-fake");
  return { ...actual, ...fake.fakeFileUploadModule(actual.checkFile) };
});

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/admin/site-content",
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/site-content.actions", () => ({
  refreshSiteContent: vi.fn(),
}));

const LIST_PATH = "/api/v1/admin/site-content";
const HERO_PATH = `${LIST_PATH}/hero`;
const SAVED_AT = "2026-11-18T10:00:00.000Z";
const NEW_AT = "2026-11-21T09:00:00.000Z";
const SOURCES_KEY = `GET ${LIST_PATH}/sources`;
const STORY_ID = "7d2a6f1e-3b4c-4d5e-8f60-718293a4b5c6";
const PHOTO_ID = "9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";

function seed(
  overrides: Partial<Record<string, Partial<AdminSiteContentItem>>> = {},
) {
  const items = BLOCK_META.map((meta) => {
    const value = SITE_CONTENT_DEFAULTS[meta.key];
    const base: AdminSiteContentItem = {
      key: meta.key,
      value,
      defaultValue: value,
      media: {},
      isDefault: true,
      updatedAt: null,
      updatedByName: null,
    };
    return { ...base, ...overrides[meta.key] };
  });
  return { items };
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Routes the site content API. `overrides` answers a "METHOD path" key itself. */
function mockApi(
  overrides: Record<string, (init?: RequestInit) => Response> = {},
  list = seed(),
) {
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const { pathname } = new URL(input, "http://localhost");
    const method = init?.method ?? "GET";
    const key = `${method} ${pathname}`;
    if (overrides[key]) return overrides[key](init);
    if (key === `GET ${LIST_PATH}`) return respond(list);
    if (key === SOURCES_KEY) return respond({ sources: [] });
    if (key === `PUT ${HERO_PATH}`) {
      const body = JSON.parse(String(init?.body)) as { value: unknown };
      return respond(
        seed({
          hero: {
            value: body.value as SiteContent["hero"],
            isDefault: false,
            updatedAt: NEW_AT,
            updatedByName: "Farabi",
          },
        }).items.find((row) => row.key === "hero"),
      );
    }
    if (key === `DELETE ${HERO_PATH}`) {
      return respond(seed().items.find((row) => row.key === "hero"));
    }
    throw new Error(`Unexpected request ${key}`);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SiteContentPage />
    </QueryClientProvider>,
  );
}

function writes() {
  return vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => init?.method && init.method !== "GET");
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  vi.mocked(refreshSiteContent).mockResolvedValue(true);
  localStorage.setItem(
    "auth_tokens",
    JSON.stringify({ accessToken: "tok", refreshToken: "refresh" }),
  );
});

describe("SiteContentPage", () => {
  it("loads and shows the hero form", async () => {
    mockApi();
    renderPage();
    expect(await screen.findByLabelText("Headline")).toHaveValue(
      SITE_CONTENT_DEFAULTS.hero.headline,
    );
    expect(screen.getByText("Showing the default")).toBeInTheDocument();
  });

  it("shows unsaved changes after an edit", async () => {
    mockApi();
    const user = userEvent.setup();
    renderPage();
    const headline = await screen.findByLabelText("Headline");
    await user.clear(headline);
    await user.type(headline, "New headline");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("saves the trimmed value with a null expectedUpdatedAt, then refreshes the landing", async () => {
    mockApi();
    const user = userEvent.setup();
    renderPage();
    const headline = await screen.findByLabelText("Headline");
    await user.clear(headline);
    await user.type(headline, "  Fresh headline  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    const [url, init] = writes()[0];
    expect(String(url)).toContain(HERO_PATH);
    expect(init?.method).toBe("PUT");
    const body = JSON.parse(String(init?.body)) as {
      value: { headline: string };
      expectedUpdatedAt: string | null;
    };
    expect(body.value.headline).toBe("Fresh headline");
    expect(body.expectedUpdatedAt).toBeNull();

    await waitFor(() => expect(refreshSiteContent).toHaveBeenCalledWith("tok"));
    expect(toast.success).toHaveBeenCalledWith(
      "Saved. The site updates in a few seconds.",
    );
    await waitFor(() =>
      expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument(),
    );
  });

  it("blocks Save on an empty headline and shows the error inline", async () => {
    mockApi();
    const user = userEvent.setup();
    renderPage();
    const headline = await screen.findByLabelText("Headline");
    await user.clear(headline);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(toast.error).toHaveBeenCalledWith(
      "Fix the highlighted fields first.",
    );
    expect(await screen.findByText("Required")).toBeInTheDocument();
    expect(headline).toHaveAttribute("aria-invalid", "true");
    expect(writes()).toHaveLength(0);
  });

  it("shows the conflict toast with a Reload action on a 409", async () => {
    mockApi({
      [`PUT ${HERO_PATH}`]: () =>
        respond(
          {
            error: "SiteContentConflict",
            code: "SITE_CONTENT_CONFLICT",
            message: "Changed by someone else",
          },
          409,
        ),
    });
    const user = userEvent.setup();
    renderPage();
    const headline = await screen.findByLabelText("Headline");
    await user.type(headline, "!");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Someone else changed this block. Reload to see their version.",
        expect.objectContaining({
          action: expect.objectContaining({ label: "Reload" }),
        }),
      ),
    );
  });

  it("asks before resetting and sends DELETE with the loaded updatedAt", async () => {
    mockApi(
      {},
      seed({
        hero: {
          isDefault: false,
          updatedAt: SAVED_AT,
          updatedByName: "Farabi",
        },
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Reset to default" }),
    );
    expect(
      await screen.findByRole("alertdialog", { name: "Reset Hero?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    const [url, init] = writes()[0];
    expect(init?.method).toBe("DELETE");
    expect(String(url)).toContain(`${HERO_PATH}?expectedUpdatedAt=`);
    expect(toast.success).toHaveBeenCalledWith("Reset to the default.");
  });

  it("asks to discard unsaved changes before switching block", async () => {
    mockApi();
    const user = userEvent.setup();
    renderPage();
    const headline = await screen.findByLabelText("Headline");
    await user.type(headline, "!");
    await user.click(screen.getByRole("button", { name: "FAQ" }));

    expect(
      await screen.findByRole("alertdialog", {
        name: "Discard unsaved changes?",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Headline")).toHaveValue(
      `${SITE_CONTENT_DEFAULTS.hero.headline}!`,
    );
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("marks a non-default block as edited in the picker", async () => {
    mockApi(
      {},
      seed({
        nav: { isDefault: false, updatedAt: SAVED_AT, updatedByName: "Farabi" },
      }),
    );
    renderPage();
    const navButton = await screen.findByRole("button", {
      name: /Navigation bar/,
    });
    expect(within(navButton).getByText("Edited")).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: /^Hero/ })).queryByText(
        "Edited",
      ),
    ).toBeNull();
  });
});

describe("ListEditor", () => {
  function Harness({ min, max }: { min: number; max: number }) {
    const [items, setItems] = useState(["alpha", "beta", "gamma"]);
    return (
      <ListEditor<string>
        label="Words"
        items={items}
        onChange={setItems}
        min={min}
        max={max}
        singular="word"
        newItem={() => "new"}
        itemLabel={(item) => item}
        renderItem={(item, i, update) => (
          <TextInput
            label={`Word ${i + 1}`}
            value={item}
            max={40}
            onChange={update}
          />
        )}
        errors={{}}
        path="words"
      />
    );
  }

  function values() {
    return screen
      .getAllByLabelText(/^Word \d/)
      .map((input) => (input as HTMLInputElement).value);
  }

  it("moves cards up and down", async () => {
    const user = userEvent.setup();
    render(<Harness min={1} max={5} />);
    expect(values()).toEqual(["alpha", "beta", "gamma"]);
    await user.click(screen.getByRole("button", { name: "Move down: alpha" }));
    expect(values()).toEqual(["beta", "alpha", "gamma"]);
    await user.click(screen.getByRole("button", { name: "Move up: gamma" }));
    expect(values()).toEqual(["beta", "gamma", "alpha"]);
  });

  it("disables Move up on the first card and Move down on the last", () => {
    render(<Harness min={1} max={5} />);
    expect(
      screen.getByRole("button", { name: "Move up: alpha" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move down: gamma" }),
    ).toBeDisabled();
  });

  it("disables Remove at the minimum, with a reason", () => {
    render(<Harness min={3} max={5} />);
    const remove = screen.getByRole("button", { name: "Remove: alpha" });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute("title", "Keep at least 3");
  });

  it("disables Add at the maximum", async () => {
    const user = userEvent.setup();
    render(<Harness min={1} max={3} />);
    expect(screen.getByRole("button", { name: "Add word" })).toBeDisabled();
    expect(screen.getByText("Up to 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove: beta" }));
    expect(screen.getByRole("button", { name: "Add word" })).toBeEnabled();
    expect(values()).toEqual(["alpha", "gamma"]);
  });
});

describe("SiteContentPage editors", () => {
  beforeEach(() => {
    // The landing carousels watch their visibility; jsdom has no IntersectionObserver.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the FAQ form instead of the placeholder", async () => {
    mockApi();
    nav.search = "block=faq";
    renderPage();
    expect(await screen.findByLabelText("Starts open")).toHaveValue(
      String(SITE_CONTENT_DEFAULTS.faq.openIndex),
    );
    expect(screen.queryByText("Editor coming next.")).not.toBeInTheDocument();
  });

  it("shows an inline error for a 91-word testimonial comment and does not save", async () => {
    mockApi();
    nav.search = "block=testimonials";
    const user = userEvent.setup();
    renderPage();
    const comment = (await screen.findAllByLabelText("Comment"))[0];
    fireEvent.change(comment, {
      target: { value: Array(91).fill("word").join(" ") },
    });
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("At most 90 words")).toBeInTheDocument();
    expect(comment).toHaveAttribute("aria-invalid", "true");
    expect(writes()).toHaveLength(0);
  });

  it("says so above the preview when the section is hidden", async () => {
    mockApi(
      {},
      seed({
        testimonials: {
          value: { ...SITE_CONTENT_DEFAULTS.testimonials, enabled: false },
          isDefault: false,
          updatedAt: SAVED_AT,
          updatedByName: "Farabi",
        },
      }),
    );
    nav.search = "block=testimonials";
    renderPage();
    expect(
      await screen.findByText("This section is hidden on the landing page."),
    ).toBeInTheDocument();
  });
});

describe("SiteContentPage media", () => {
  const FILE = "5b6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e8f";
  const UPLOADED = {
    url: "https://cdn.example.com/ayesha.png",
    contentType: "image/png",
    originalName: "ayesha.png",
    purpose: "SITE_IMAGE" as const,
  };

  /** The testimonials block with its first photo uploaded. */
  function withUploadedPhoto(media: Record<string, typeof UPLOADED>) {
    const testimonials = {
      ...SITE_CONTENT_DEFAULTS.testimonials,
      items: [
        {
          ...SITE_CONTENT_DEFAULTS.testimonials.items[0],
          photo: `file:${FILE}`,
        },
        ...SITE_CONTENT_DEFAULTS.testimonials.items.slice(1),
      ],
    };
    return seed({
      testimonials: {
        value: testimonials,
        isDefault: false,
        updatedAt: SAVED_AT,
        updatedByName: "Farabi",
        media,
      },
    });
  }

  beforeEach(() => {
    // The testimonials preview is a carousel, which watches its size.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:ayesha"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    started.length = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an uploaded photo by its file name and previews its URL", async () => {
    nav.search = "block=testimonials";
    mockApi({}, withUploadedPhoto({ [FILE]: UPLOADED }));
    const { container } = renderPage();
    expect(await screen.findByText("Uploaded: ayesha.png")).toBeInTheDocument();
    // The preview sits in the inert box; the photo there uses the resolved URL.
    await waitFor(() =>
      expect(
        container.querySelector(`[inert] img[src="${UPLOADED.url}"]`),
      ).not.toBeNull(),
    );
  });

  it("holds Save while an upload runs, then saves the uploaded file", async () => {
    nav.search = "block=testimonials";
    mockApi({
      [`PUT ${LIST_PATH}/testimonials`]: (init) => {
        const body = JSON.parse(String(init?.body)) as {
          value: SiteContent["testimonials"];
        };
        return respond(
          withUploadedPhoto({ [FILE]: UPLOADED }).items.find(
            (row) => row.key === "testimonials",
          ) && {
            ...withUploadedPhoto({ [FILE]: UPLOADED }).items.find(
              (row) => row.key === "testimonials",
            ),
            value: body.value,
          },
        );
      },
    });
    const user = userEvent.setup();
    const { container } = renderPage();
    const quote = (await screen.findAllByLabelText("Quote"))[0];
    await user.type(quote, "!");
    await user.click(
      screen.getAllByRole("radio", { name: "Upload a file" })[0],
    );
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(
      input,
      new File(["png"], "ayesha.png", { type: "image/png" }),
    );

    expect(
      await screen.findByText("Save when the upload finishes."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await act(async () => {
      started[0].finish(uploadedAsset({ id: FILE, fileName: "ayesha.png" }));
    });
    const save = await screen.findByRole("button", { name: "Save" });
    await waitFor(() => expect(save).toBeEnabled());

    await user.click(save);
    await waitFor(() => expect(writes()).toHaveLength(1));
    const body = JSON.parse(String(writes()[0][1]?.body)) as {
      value: SiteContent["testimonials"];
    };
    expect(body.value.items[0].photo).toBe(`file:${FILE}`);
  });
});

/** An approved student story, as the sources endpoint lists it. */
function submission(overrides: Partial<AdminSiteSource> = {}): AdminSiteSource {
  return {
    source: { kind: "story", id: STORY_ID },
    authorName: "Ayesha Rahman",
    role: "STUDENT",
    headline: "Clear and patient.",
    body: "The tutor explained every step.",
    title: null,
    imageRef: `file:${PHOTO_ID}`,
    videoRef: null,
    media: {
      [PHOTO_ID]: {
        url: "https://files.example/photo.png",
        contentType: "image/png",
        originalName: "photo.png",
        purpose: "STORY_IMAGE",
      },
    },
    subjectHint: "Physics",
    instituteHint: "BRAC University",
    consentAt: "2026-11-18T10:00:00.000Z",
    onLanding: false,
    ...overrides,
  };
}

function sourcesRoute(sources: AdminSiteSource[]) {
  return { [SOURCES_KEY]: () => respond({ sources }) };
}

describe("Add from submissions", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    // The showcase preview measures its track.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists the approved stories and adds one as a card with its source and photo", async () => {
    mockApi(sourcesRoute([submission()]));
    const user = userEvent.setup();
    nav.search = "block=testimonials";
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Add from submissions" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Add from submissions",
    });
    expect(within(dialog).getByText("Ayesha Rahman")).toBeInTheDocument();
    expect(within(dialog).getByText("Agreed 18 Nov 2026")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add from submissions" }),
      ).not.toBeInTheDocument(),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Card added. Fill in any empty fields, then save.",
    );
    expect(
      screen.getByText("From Ayesha Rahman's submission"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Uploaded by Ayesha Rahman"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        document.querySelector('img[src="https://files.example/photo.png"]'),
      ).not.toBeNull(),
    );
  });

  it("shows a submission already in the draft as added and disabled", async () => {
    const testimonials = SITE_CONTENT_DEFAULTS.testimonials;
    const value = {
      ...testimonials,
      items: [
        cardFromSource("testimonials", submission()),
        ...testimonials.items.slice(1),
      ],
    };
    mockApi(
      sourcesRoute([submission()]),
      seed({
        testimonials: {
          value,
          isDefault: false,
          updatedAt: SAVED_AT,
          updatedByName: "Farabi",
        },
      }),
    );
    const user = userEvent.setup();
    nav.search = "block=testimonials";
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Add from submissions" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Add from submissions",
    });
    expect(
      within(dialog).getByRole("button", { name: "Added" }),
    ).toBeDisabled();
    expect(
      within(dialog).queryByRole("button", { name: "Add" }),
    ).not.toBeInTheDocument();
  });

  it("disables Add from submissions when the list is full", async () => {
    const card = SITE_CONTENT_DEFAULTS.testimonials.items[0];
    mockApi(
      {},
      seed({
        testimonials: {
          value: {
            ...SITE_CONTENT_DEFAULTS.testimonials,
            items: Array.from({ length: 12 }, () => card),
          },
          isDefault: false,
          updatedAt: SAVED_AT,
          updatedByName: "Farabi",
        },
      }),
    );
    nav.search = "block=testimonials";
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Add from submissions" }),
    ).toBeDisabled();
    expect(screen.getByText("Up to 12")).toBeInTheDocument();
  });

  it("explains the empty showcase list and links to Stories", async () => {
    mockApi(sourcesRoute([]));
    const user = userEvent.setup();
    nav.search = "block=showcase";
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Add from submissions" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Add from submissions",
    });
    expect(
      within(dialog).getByText("No approved tutor stories or videos yet."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Open Stories" }),
    ).toHaveAttribute("href", "/dashboard/admin/stories");
  });

  it("shows a 400 on the card's source after Save", async () => {
    const testimonials = SITE_CONTENT_DEFAULTS.testimonials;
    mockApi(
      {
        [`PUT ${LIST_PATH}/testimonials`]: () =>
          respond(
            {
              error: "ValidationError",
              code: "VALIDATION_ERROR",
              message: "Invalid",
              issues: [
                {
                  path: ["value", "items", 0, "source"],
                  message: "This submission is no longer approved",
                },
              ],
            },
            400,
          ),
      },
      seed({
        testimonials: {
          value: {
            ...testimonials,
            items: [
              cardFromSource("testimonials", submission()),
              ...testimonials.items.slice(1),
            ],
          },
          isDefault: false,
          updatedAt: SAVED_AT,
          updatedByName: "Farabi",
        },
      }),
    );
    const user = userEvent.setup();
    nav.search = "block=testimonials";
    renderPage();

    const quote = (await screen.findAllByLabelText("Quote"))[0];
    await user.type(quote, "!");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This submission is no longer approved",
    );
  });
});
