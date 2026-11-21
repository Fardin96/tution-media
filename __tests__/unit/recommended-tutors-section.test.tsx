import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { RecommendedTutorsSection } from "@/components/applications/recommended-tutors-section";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const REQUIREMENT_ID = "req-1";
const INVITED_AT = "2026-11-20T10:00:00.000Z";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Row = {
  tutor: {
    id: string;
    name: string;
    instituteName: string | null;
    gender: "MALE" | "FEMALE" | "OTHER";
    ratingAvg: number;
    ratingCount: number;
    verificationStatus: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
    areas: { id: number; name: string }[];
    subjects: { id: number; name: string }[];
  };
  reasons: { rule: string; ok: boolean; label: string }[];
  invitedAt: string | null;
  application: { id: string; status: string } | null;
};

function row(id: string, name: string, over: Partial<Row> = {}): Row {
  return {
    tutor: {
      id,
      name,
      instituteName: "University of Dhaka",
      gender: "MALE",
      ratingAvg: 4.5,
      ratingCount: 12,
      verificationStatus: "APPROVED",
      areas: [],
      subjects: [{ id: 2, name: "Physics" }],
    },
    reasons: [
      { rule: "curriculum", ok: true, label: "Teaches the curriculum" },
      { rule: "salary", ok: false, label: "Salary below the offer" },
    ],
    invitedAt: null,
    application: null,
    ...over,
  };
}

function page(
  tutors: Row[],
  over: {
    page?: number;
    hasMore?: boolean;
    total?: number;
    suggestions?: {
      code: "ALLOW_ONLINE" | "ANY_GENDER";
      extraTutors: number;
    }[];
  } = {},
) {
  return {
    tutors,
    total: over.total ?? tutors.length,
    page: over.page ?? 1,
    hasMore: over.hasMore ?? false,
    matchVersion: 3,
    suggestions: over.suggestions ?? [],
  };
}

/** A fake server behind apiFetch. Invites mark the tutor as invited, as the server would. */
let state: {
  requirementStatus: string;
  pages: Record<number, ReturnType<typeof page>>;
  inviteStatus: number;
  inviteBody: unknown;
};

function mockApi(next: Partial<typeof state>) {
  state = {
    requirementStatus: "OPEN",
    pages: { 1: page([]) },
    inviteStatus: 201,
    inviteBody: null,
    ...next,
  };
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname;

    if (method === "GET" && path === `/api/v1/requirements/${REQUIREMENT_ID}`) {
      return json(200, { id: REQUIREMENT_ID, status: state.requirementStatus });
    }

    if (
      method === "GET" &&
      path === `/api/v1/requirements/${REQUIREMENT_ID}/tutors`
    ) {
      const pageNumber = Number(url.searchParams.get("page") ?? "1");
      return json(200, state.pages[pageNumber] ?? page([]));
    }

    if (
      method === "POST" &&
      path === `/api/v1/requirements/${REQUIREMENT_ID}/invites`
    ) {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        tutorId: string;
      };
      state.inviteBody = body;
      if (state.inviteStatus !== 201) {
        return json(state.inviteStatus, {
          code: "INVITE_EXISTS",
          message: "You already invited this tutor.",
        });
      }
      for (const p of Object.values(state.pages)) {
        for (const r of p.tutors) {
          if (r.tutor.id === body.tutorId) r.invitedAt = INVITED_AT;
        }
      }
      return json(201, {
        id: "inv-1",
        requirementId: REQUIREMENT_ID,
        tutorId: body.tutorId,
        createdAt: INVITED_AT,
      });
    }

    return json(404, { code: "NOT_FOUND", message: "not mocked" });
  });
}

function requests() {
  return vi.mocked(apiFetch).mock.calls.map(([input, init]) => ({
    method: (init?.method ?? "GET").toUpperCase(),
    url: new URL(String(input)),
  }));
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RecommendedTutorsSection requirementId={REQUIREMENT_ID} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RecommendedTutorsSection", () => {
  it("invites a tutor, shows Invited, and confirms with a toast", async () => {
    mockApi({ pages: { 1: page([row("t1", "Rafiq Ahmed")]) } });
    const user = userEvent.setup();
    renderSection();

    const card = (
      await screen.findByRole("heading", { name: "Rafiq Ahmed" })
    ).closest("article");
    if (!card) throw new Error("tutor card not rendered");

    await user.click(
      within(card).getByRole("button", { name: /Invite to apply/ }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Invite sent to Rafiq Ahmed."),
    );
    expect(state.inviteBody).toEqual({ tutorId: "t1" });
    const post = requests().find((r) => r.method === "POST");
    expect(post?.url.pathname).toBe(
      `/api/v1/requirements/${REQUIREMENT_ID}/invites`,
    );

    const invited = await within(card).findByRole("button", {
      name: /Invited/,
    });
    expect(invited).toBeDisabled();
    expect(
      within(card).queryByRole("button", { name: /Invite to apply/ }),
    ).not.toBeInTheDocument();
  });

  it("shows Invited from the start when the invite already exists", async () => {
    mockApi({
      pages: { 1: page([row("t1", "Rafiq Ahmed", { invitedAt: INVITED_AT })]) },
    });
    renderSection();

    const card = (
      await screen.findByRole("heading", { name: "Rafiq Ahmed" })
    ).closest("article");
    if (!card) throw new Error("tutor card not rendered");
    expect(
      within(card).getByRole("button", { name: /Invited/ }),
    ).toBeDisabled();
  });

  it("shows the application status instead of an invite button", async () => {
    mockApi({
      pages: {
        1: page([
          row("t1", "Rafiq Ahmed", {
            application: { id: "app-1", status: "PENDING" },
          }),
        ]),
      },
    });
    renderSection();

    const card = (
      await screen.findByRole("heading", { name: "Rafiq Ahmed" })
    ).closest("article");
    if (!card) throw new Error("tutor card not rendered");
    expect(within(card).getByText("Pending")).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: /Invite to apply/ }),
    ).not.toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: /View profile/ }),
    ).toHaveAttribute("href", "/tutors/t1");
  });

  it("lists the match reasons without a numeric score", async () => {
    mockApi({ pages: { 1: page([row("t1", "Rafiq Ahmed")]) } });
    renderSection();

    const list = await screen.findByRole("list", { name: "Match reasons" });
    expect(
      within(list).getByText("Teaches the curriculum"),
    ).toBeInTheDocument();
    expect(
      within(list).getByText("Salary below the offer"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  });

  it("shows suggestions and a note when no tutor matches", async () => {
    mockApi({
      pages: {
        1: page([], {
          total: 0,
          suggestions: [
            { code: "ALLOW_ONLINE", extraTutors: 2 },
            { code: "ANY_GENDER", extraTutors: 1 },
          ],
        }),
      },
    });
    renderSection();

    expect(
      await screen.findByText("No tutors match this tuition yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Allow online tuition: 2 more tutors" }),
    ).toHaveAttribute("href", `/dashboard/requirements/${REQUIREMENT_ID}/edit`);
    expect(
      screen.getByRole("link", {
        name: "Accept any tutor gender: 1 more tutor",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("New tutors show up here when they join."),
    ).toBeInTheDocument();
  });

  it("hides the section when the requirement is not open", async () => {
    mockApi({ requirementStatus: "FILLED" });
    renderSection();

    await waitFor(() =>
      expect(requests().map((r) => r.url.pathname)).toContain(
        `/api/v1/requirements/${REQUIREMENT_ID}`,
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      screen.queryByRole("heading", { name: "Recommended tutors" }),
    ).not.toBeInTheDocument();
    expect(requests().some((r) => r.url.pathname.endsWith("/tutors"))).toBe(
      false,
    );
  });

  it("appends the next page on Show more tutors", async () => {
    mockApi({
      pages: {
        1: page([row("t1", "Rafiq Ahmed")], { hasMore: true, total: 2 }),
        2: page([row("t2", "Nadia Karim")], { page: 2, total: 2 }),
      },
    });
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole("heading", { name: "Rafiq Ahmed" });
    await user.click(screen.getByRole("button", { name: "Show more tutors" }));

    expect(
      await screen.findByRole("heading", { name: "Nadia Karim" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Rafiq Ahmed" }),
    ).toBeInTheDocument();
    expect(
      requests().some(
        (r) =>
          r.url.pathname.endsWith("/tutors") &&
          r.url.searchParams.get("page") === "2",
      ),
    ).toBe(true);
  });

  it("shows the server's message when the invite fails", async () => {
    mockApi({
      inviteStatus: 409,
      pages: { 1: page([row("t1", "Rafiq Ahmed")]) },
    });
    const user = userEvent.setup();
    renderSection();

    const card = (
      await screen.findByRole("heading", { name: "Rafiq Ahmed" })
    ).closest("article");
    if (!card) throw new Error("tutor card not rendered");
    await user.click(
      within(card).getByRole("button", { name: /Invite to apply/ }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "You already invited this tutor.",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
