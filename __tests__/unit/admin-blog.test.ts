import { describe, expect, it } from "vitest";
import {
  blogFormFrom,
  emptyBlogForm,
  slugify,
  toBlogPatch,
  toCreateBlogPost,
  validateBlogForm,
  type AdminBlogPost,
  type BlogForm,
} from "@/lib/admin-blog";

const SLUG_RULE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function form(overrides: Partial<BlogForm> = {}): BlogForm {
  return {
    title: "Study plans for SSC",
    slug: "study-plans-for-ssc",
    excerpt: "A short summary.",
    body: "Start with the syllabus.",
    coverFileId: null,
    ...overrides,
  };
}

function post(overrides: Partial<AdminBlogPost> = {}): AdminBlogPost {
  return {
    id: "post-1",
    slug: "study-plans-for-ssc",
    title: "Study plans for SSC",
    excerpt: "A short summary.",
    body: "Start with the syllabus.",
    status: "DRAFT",
    publishedAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    authorId: "admin-1",
    authorName: "Farabi",
    cover: null,
    ...overrides,
  };
}

describe("slugify", () => {
  it("lowercases and joins words with single hyphens", () => {
    expect(slugify("  Study Plans:  for SSC!! ")).toBe("study-plans-for-ssc");
  });

  it("folds accents to their base letters", () => {
    expect(slugify("Café Crème")).toBe("cafe-creme");
  });

  it("returns an empty string when the title has no Latin letters or digits", () => {
    expect(slugify("পরীক্ষা")).toBe("");
    expect(slugify("---")).toBe("");
  });

  it("caps the slug at 120 characters without a trailing hyphen", () => {
    const slug = slugify(`${"word ".repeat(40)}end`);
    expect(slug.length).toBeLessThanOrEqual(120);
    expect(slug.endsWith("-")).toBe(false);
    expect(SLUG_RULE.test(slug)).toBe(true);
  });

  it("always matches the API slug pattern", () => {
    for (const title of ["Hello World", "10 tips: part 2", "a--b", "  x  "]) {
      expect(SLUG_RULE.test(slugify(title))).toBe(true);
    }
  });
});

describe("validateBlogForm", () => {
  it("accepts a complete form", () => {
    expect(validateBlogForm(form())).toEqual({});
  });

  it("requires a title of 3 to 160 characters", () => {
    expect(validateBlogForm(form({ title: "  " })).title).toBe(
      "Enter a title.",
    );
    expect(validateBlogForm(form({ title: "Hi" })).title).toBeDefined();
    expect(validateBlogForm(form({ title: "abc" })).title).toBeUndefined();
    expect(
      validateBlogForm(form({ title: "x".repeat(161) })).title,
    ).toBeDefined();
    expect(
      validateBlogForm(form({ title: "x".repeat(160) })).title,
    ).toBeUndefined();
  });

  it("requires a slug that matches the API pattern", () => {
    expect(validateBlogForm(form({ slug: "" })).slug).toBe(
      "Enter a link slug.",
    );
    expect(validateBlogForm(form({ slug: "Bad Slug" })).slug).toBeDefined();
    expect(validateBlogForm(form({ slug: "trailing-" })).slug).toBeDefined();
    expect(validateBlogForm(form({ slug: "ok-slug-2" })).slug).toBeUndefined();
    expect(
      validateBlogForm(form({ slug: "a".repeat(121) })).slug,
    ).toBeDefined();
  });

  it("caps the excerpt at 300 characters and allows it to be empty", () => {
    expect(validateBlogForm(form({ excerpt: "" })).excerpt).toBeUndefined();
    expect(
      validateBlogForm(form({ excerpt: "x".repeat(300) })).excerpt,
    ).toBeUndefined();
    expect(
      validateBlogForm(form({ excerpt: "x".repeat(301) })).excerpt,
    ).toBeDefined();
  });

  it("requires a body of 1 to 50000 characters", () => {
    expect(validateBlogForm(form({ body: "   " })).body).toBe(
      "Write the post body.",
    );
    expect(
      validateBlogForm(form({ body: "x".repeat(50_000) })).body,
    ).toBeUndefined();
    expect(
      validateBlogForm(form({ body: "x".repeat(50_001) })).body,
    ).toBeDefined();
  });
});

describe("toCreateBlogPost", () => {
  it("sends trimmed text, the chosen status and no empty optional fields", () => {
    expect(
      toCreateBlogPost(
        form({ title: "  Hello  ", excerpt: "   ", body: " Hi " }),
        "DRAFT",
      ),
    ).toEqual({
      title: "Hello",
      slug: "study-plans-for-ssc",
      body: "Hi",
      status: "DRAFT",
    });
  });

  it("includes the excerpt and cover when set", () => {
    expect(
      toCreateBlogPost(form({ coverFileId: "file-1" }), "PUBLISHED"),
    ).toMatchObject({
      excerpt: "A short summary.",
      coverFileId: "file-1",
      status: "PUBLISHED",
    });
  });
});

describe("toBlogPatch", () => {
  it("returns an empty patch when nothing changed", () => {
    const initial = blogFormFrom(post());
    expect(toBlogPatch(initial, form())).toEqual({});
  });

  it("sends only the fields that changed", () => {
    const initial = blogFormFrom(post());
    expect(toBlogPatch(initial, form({ title: "New title" }))).toEqual({
      title: "New title",
    });
    expect(toBlogPatch(initial, form({ body: "Changed body" }))).toEqual({
      body: "Changed body",
    });
  });

  it("sends null for an excerpt that was cleared", () => {
    const initial = blogFormFrom(post());
    expect(toBlogPatch(initial, form({ excerpt: "  " }))).toEqual({
      excerpt: null,
    });
  });

  it("sends the new cover id, or null when the cover was removed", () => {
    const initial = blogFormFrom(post({ cover: { fileId: "old", url: "u" } }));
    expect(toBlogPatch(initial, form({ coverFileId: "new" }))).toEqual({
      coverFileId: "new",
    });
    expect(toBlogPatch(initial, form({ coverFileId: null }))).toEqual({
      coverFileId: null,
    });
  });

  it("ignores whitespace-only differences", () => {
    const initial = blogFormFrom(post());
    expect(
      toBlogPatch(initial, form({ title: "Study plans for SSC  " })),
    ).toEqual({});
  });

  it("starts an empty form with no changes against itself", () => {
    expect(toBlogPatch(emptyBlogForm(), emptyBlogForm())).toEqual({});
  });
});
