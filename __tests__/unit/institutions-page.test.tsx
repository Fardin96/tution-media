import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { InstitutionsPage } from "@/components/admin/institutions-page";
import { adminInstitutionApi, type AdminInstitution } from "@/lib/institutions";
import { ApiError } from "@/lib/profile";

const state = vi.hoisted(() => ({
  isSuperAdmin: true,
  isPending: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/admin", () => ({
  useAdminMe: () => ({
    isSuperAdmin: state.isSuperAdmin,
    isPending: state.isPending,
    adminUser: null,
    isActive: true,
  }),
}));

function institution(
  overrides: Partial<AdminInstitution> = {},
): AdminInstitution {
  return {
    id: 2,
    name: "University of Dhaka",
    kind: "UNIVERSITY",
    district: "Dhaka",
    area: null,
    eiin: null,
    aliases: ["DU"],
    isActive: true,
    popularity: 100,
    tutorCount: 3,
    requirementCount: 1,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockList(rows: AdminInstitution[]) {
  return vi.spyOn(adminInstitutionApi, "list").mockResolvedValue({
    institutions: rows,
    total: rows.length,
  });
}

function render(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  state.isSuperAdmin = true;
  state.isPending = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InstitutionsPage access", () => {
  it("tells a non-super admin why the page is empty, and asks for nothing", async () => {
    state.isSuperAdmin = false;
    const list = mockList([institution()]);
    render(<InstitutionsPage />);

    expect(
      screen.getByText(
        "Only a super admin can manage schools and universities.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add" }),
    ).not.toBeInTheDocument();
    // Give a request a chance to start before asserting that none did.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(list).not.toHaveBeenCalled();
  });

  it("shows a loader while the role is unknown, without asking for the list", () => {
    // Until GET /me answers there is no super admin role, so isSuperAdmin is false.
    state.isSuperAdmin = false;
    state.isPending = true;
    const list = mockList([]);
    render(<InstitutionsPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading schools and universities",
    );
    expect(list).not.toHaveBeenCalled();
  });
});

describe("InstitutionsPage for a super admin", () => {
  it("lists schools with their place, short names and usage", async () => {
    mockList([
      institution(),
      institution({
        id: 9,
        name: "Viqarunnisa Noon School and College",
        kind: "SCHOOL_AND_COLLEGE",
        district: "Dhaka",
        area: "Dhanmondi",
        aliases: [],
        tutorCount: 0,
        requirementCount: 0,
      }),
    ]);
    render(<InstitutionsPage />);

    const row = (await screen.findByText("University of Dhaka")).closest("li")!;
    expect(within(row).getByText("University · Dhaka")).toBeInTheDocument();
    expect(within(row).getByText("DU")).toBeInTheDocument();
    expect(
      within(row).getByText("Used by 3 tutors · 1 requirement"),
    ).toBeInTheDocument();

    const other = screen
      .getByText("Viqarunnisa Noon School and College")
      .closest("li")!;
    expect(
      within(other).getByText("School and college · Dhanmondi, Dhaka"),
    ).toBeInTheDocument();
    expect(within(other).queryByText(/Used by/)).not.toBeInTheDocument();
    expect(screen.getByText("2 on the list")).toBeInTheDocument();
  });

  it("hides an institution from the list through PATCH isActive", async () => {
    mockList([institution()]);
    const update = vi
      .spyOn(adminInstitutionApi, "update")
      .mockResolvedValue(institution({ isActive: false }));
    render(<InstitutionsPage />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Hide University of Dhaka" }),
    );

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(2, { isActive: false }),
    );
  });

  it("adds an institution, and shows INSTITUTION_EXISTS on the name field", async () => {
    mockList([]);
    const create = vi.spyOn(adminInstitutionApi, "create").mockRejectedValue(
      new ApiError("This school or university is already on the list.", 409, {
        code: "INSTITUTION_EXISTS",
      }),
    );
    render(<InstitutionsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Add" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Add school or university",
    });
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Viqarunnisa Noon School",
    );
    await userEvent.click(within(dialog).getByText("School"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        name: "Viqarunnisa Noon School",
        kind: "SCHOOL",
        district: null,
        area: null,
        aliases: [],
      }),
    );
    expect(
      await within(dialog).findByText(
        "This school or university is already on the list.",
      ),
    ).toBeInTheDocument();
  });

  it("asks for a type before it sends the form", async () => {
    mockList([]);
    const create = vi.spyOn(adminInstitutionApi, "create");
    render(<InstitutionsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Add" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Add school or university",
    });
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Holy Cross College",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(
      await within(dialog).findByText("Choose a type."),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});
