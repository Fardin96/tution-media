import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "@/components/SearchBar";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("SearchBar", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it("renders two inputs and a submit button", () => {
    render(<SearchBar />);
    expect(
      screen.getByRole("searchbox", { name: /skill or role/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /location/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("navigates to /talents with query params on submit", async () => {
    render(<SearchBar />);
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
    render(<SearchBar />);
    await userEvent.type(
      screen.getByRole("searchbox", { name: /skill or role/i }),
      "Physics",
    );
    await userEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(mockPush).toHaveBeenCalledWith("/talents?q=Physics");
  });
});
