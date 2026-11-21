import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "@/components/SearchBar";
import { SITE_CONTENT_DEFAULTS } from "@/lib/site-content";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const hero = SITE_CONTENT_DEFAULTS.hero;

describe("SearchBar", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it("renders two inputs and a submit button", () => {
    render(<SearchBar {...hero} />);
    expect(
      screen.getByRole("searchbox", { name: /skill or role/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /location/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("navigates to /talents with query params on submit", async () => {
    render(<SearchBar {...hero} />);
    const skillInput = screen.getByRole("searchbox", {
      name: /skill or role/i,
    });
    const locationInput = screen.getByRole("textbox", { name: /location/i });

    await userEvent.type(skillInput, "Math Tutor");
    await userEvent.type(locationInput, "Dhaka");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    expect(mockPush).toHaveBeenCalledWith(
      "/talents?q=Math+Tutor&location=Dhaka",
    );
  });

  it("omits empty params from the query string", async () => {
    render(<SearchBar {...hero} />);
    await userEvent.type(
      screen.getByRole("searchbox", { name: /skill or role/i }),
      "Physics",
    );
    await userEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(mockPush).toHaveBeenCalledWith("/talents?q=Physics");
  });
});
