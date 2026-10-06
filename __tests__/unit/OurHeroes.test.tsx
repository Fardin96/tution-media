import { render, screen } from "@testing-library/react";
import OurHeroes from "@/components/OurHeroes";

describe("OurHeroes", () => {
  it("renders four center photos", () => {
    render(<OurHeroes />);
    const images = screen.getAllByTestId("next-image");
    expect(images).toHaveLength(18); // 7 repeats each side + 4 center
  });

  it("uses the four unique photo sources", () => {
    render(<OurHeroes />);
    const images = screen.getAllByTestId("next-image");
    const srcs = [
      ...new Set(images.map((img) => (img as HTMLImageElement).src)),
    ];
    expect(srcs).toHaveLength(4);
  });
});
