import { render } from "@testing-library/react";
import { Testimonials } from "@/components/testimonials";
import { isRemoteSrc, SITE_CONTENT_DEFAULTS as D } from "@/lib/site-content";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("isRemoteSrc", () => {
  it("is true for http and https URLs", () => {
    expect(isRemoteSrc("https://media.example.com/photo.png")).toBe(true);
    expect(
      isRemoteSrc("http://media.example.com/a.jpg?X-Amz-Signature=x"),
    ).toBe(true);
  });

  it("is false for local paths and other schemes", () => {
    expect(isRemoteSrc("/assets/avatar-demo/client/client1.png")).toBe(false);
    expect(isRemoteSrc("/videos/tutor1.mp4")).toBe(false);
    expect(isRemoteSrc("data:image/png;base64,AAAA")).toBe(false);
    expect(isRemoteSrc("")).toBe(false);
  });
});

describe("Testimonials media", () => {
  beforeAll(() => {
    // The card's visibility check uses IntersectionObserver, which jsdom lacks.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("renders a remote photo as-is without crashing", () => {
    const remote =
      "https://media.example.com/testimonial.webp?X-Amz-Expires=3600";
    const content = {
      ...D.testimonials,
      items: [{ ...D.testimonials.items[0], photo: remote }],
    };
    const { container } = render(<Testimonials content={content} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", remote);
  });
});
