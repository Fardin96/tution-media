import { describe, expect, it } from "vitest";
import {
  adjustOpenIndex,
  agreedText,
  BLOCK_META,
  apiFieldErrors,
  cardFromSource,
  mediaRefIds,
  resolveMedia,
  sourceKey,
  sourceOwners,
  updatedText,
  validateBlock,
  type AdminSiteContentItem,
  type AdminSiteSource,
  type MediaMap,
} from "@/lib/admin-site-content";
import { ApiError } from "@/lib/profile";
import { SITE_CONTENT_DEFAULTS, type SiteContent } from "@/lib/site-content";
import { SITE_CONTENT_KEYS } from "@/lib/site-content-schema";

function item(
  overrides: Partial<AdminSiteContentItem> = {},
): AdminSiteContentItem {
  return {
    key: "hero",
    value: SITE_CONTENT_DEFAULTS.hero,
    defaultValue: SITE_CONTENT_DEFAULTS.hero,
    media: {},
    isDefault: true,
    updatedAt: null,
    updatedByName: null,
    ...overrides,
  };
}

describe("validateBlock", () => {
  it.each(BLOCK_META.map((meta) => meta.key))(
    "accepts the shipped default for %s",
    (key) => {
      expect(validateBlock(key, SITE_CONTENT_DEFAULTS[key])).toMatchObject({
        ok: true,
      });
    },
  );

  it("trims the value it returns", () => {
    const result = validateBlock("hero", {
      ...SITE_CONTENT_DEFAULTS.hero,
      headline: "  Find a tutor  ",
    });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.value.headline).toBe("Find a tutor");
  });

  it("reports an empty hero headline on 'headline'", () => {
    const result = validateBlock("hero", {
      ...SITE_CONTENT_DEFAULTS.hero,
      headline: "   ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.headline).toBe("Required");
  });

  it("reports a bad nav href on 'links.0.href'", () => {
    const nav: SiteContent["nav"] = {
      ...SITE_CONTENT_DEFAULTS.nav,
      links: [{ label: "Bad", href: "javascript:alert(1)" }],
    };
    const result = validateBlock("nav", nav);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["links.0.href"]).toBeDefined();
  });

  it("reports a 91-word testimonial comment on 'items.0.comment'", () => {
    const testimonials = SITE_CONTENT_DEFAULTS.testimonials;
    const result = validateBlock("testimonials", {
      ...testimonials,
      items: [
        {
          ...testimonials.items[0],
          comment: Array.from({ length: 91 }, () => "word").join(" "),
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors["items.0.comment"]).toBe("At most 90 words");
    }
  });

  it("reports an faq openIndex past the last question on 'openIndex'", () => {
    const faq = SITE_CONTENT_DEFAULTS.faq;
    const result = validateBlock("faq", {
      ...faq,
      items: faq.items.slice(0, 2),
      openIndex: 5,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.openIndex).toBe("Pick a question from the list");
  });
});

describe("apiFieldErrors", () => {
  it("maps value.* issue paths to block paths", () => {
    const err = new ApiError("Validation failed", 400, {
      code: "VALIDATION_ERROR",
      issues: [
        { path: ["value", "items", 2, "quote"], message: "Required" },
        { path: ["value", "items", 2, "quote"], message: "Second message" },
        { path: ["value", "headline"], message: "At most 80 characters" },
      ],
    });
    expect(apiFieldErrors(err)).toEqual({
      "items.2.quote": "Required",
      headline: "At most 80 characters",
    });
  });

  it("ignores errors that are not 400 validation errors", () => {
    expect(apiFieldErrors(new ApiError("Conflict", 409))).toEqual({});
    expect(apiFieldErrors(new Error("network"))).toEqual({});
  });
});

describe("updatedText", () => {
  it("says the default is showing when nothing was saved", () => {
    expect(updatedText(item())).toBe("Showing the default");
  });

  it("names the admin who saved and when", () => {
    const text = updatedText(
      item({
        isDefault: false,
        updatedAt: "2026-11-18T10:00:00.000Z",
        updatedByName: "Farabi",
      }),
    );
    expect(text).toMatch(/^Edited .+ by Farabi$/);
  });

  it("falls back when the admin has been removed", () => {
    const text = updatedText(
      item({ isDefault: false, updatedAt: "2026-11-18T10:00:00.000Z" }),
    );
    expect(text).toMatch(/ by a removed admin$/);
  });
});

describe("BLOCK_META", () => {
  it("covers every site content key exactly once", () => {
    const keys = BLOCK_META.map((meta) => meta.key).sort();
    expect(keys).toEqual([...SITE_CONTENT_KEYS].sort());
    expect(new Set(keys).size).toBe(14);
  });
});

describe("adjustOpenIndex", () => {
  it("keeps the open question when an item before it is removed", () => {
    expect(adjustOpenIndex(3, { type: "remove", index: 1 })).toBe(2);
  });

  it("keeps the open question when an item after it is removed", () => {
    expect(adjustOpenIndex(1, { type: "remove", index: 3 })).toBe(1);
  });

  it("closes when the open question itself is removed", () => {
    expect(adjustOpenIndex(2, { type: "remove", index: 2 })).toBeNull();
  });

  it("follows the open question when it is moved", () => {
    expect(adjustOpenIndex(1, { type: "move", from: 1, to: 4 })).toBe(4);
    expect(adjustOpenIndex(4, { type: "move", from: 4, to: 0 })).toBe(0);
  });

  it("shifts the open index when an item moves down across it", () => {
    // Item 0 moves to 2, past the open item at 1: the open item becomes 0.
    expect(adjustOpenIndex(1, { type: "move", from: 0, to: 2 })).toBe(0);
  });

  it("shifts the open index when an item moves up across it", () => {
    // Item 3 moves to 0, past the open item at 1: the open item becomes 2.
    expect(adjustOpenIndex(1, { type: "move", from: 3, to: 0 })).toBe(2);
  });

  it("leaves the open index alone when a move does not cross it", () => {
    expect(adjustOpenIndex(0, { type: "move", from: 2, to: 3 })).toBe(0);
    expect(adjustOpenIndex(4, { type: "move", from: 1, to: 2 })).toBe(4);
  });

  it("keeps null as null for any change", () => {
    expect(adjustOpenIndex(null, { type: "remove", index: 0 })).toBeNull();
    expect(adjustOpenIndex(null, { type: "move", from: 0, to: 3 })).toBeNull();
  });
});

describe("resolveMedia", () => {
  const PHOTO = "11111111-1111-4111-8111-111111111111";
  const VIDEO = "22222222-2222-4222-8222-222222222222";
  const POSTER = "33333333-3333-4333-8333-333333333333";
  const UNKNOWN = "44444444-4444-4444-8444-444444444444";
  const media: MediaMap = {
    [PHOTO]: {
      url: "blob:http://localhost/photo",
      contentType: "image/png",
      originalName: "ayesha.png",
    },
    [VIDEO]: {
      url: "https://cdn.example.com/video.mp4",
      contentType: "video/mp4",
      originalName: "intro.mp4",
    },
    [POSTER]: {
      url: null,
      contentType: "image/png",
      originalName: null,
    },
  };

  function draft() {
    const base = SITE_CONTENT_DEFAULTS.how_it_works;
    return {
      testimonials: {
        ...SITE_CONTENT_DEFAULTS.testimonials,
        items: [
          {
            ...SITE_CONTENT_DEFAULTS.testimonials.items[0],
            photo: `file:${PHOTO}`,
          },
          {
            ...SITE_CONTENT_DEFAULTS.testimonials.items[1],
            photo: `file:${UNKNOWN}`,
          },
        ],
      },
      how_it_works: {
        ...base,
        find: {
          ...base.find,
          video: {
            ...base.find.video,
            video: `file:${VIDEO}`,
            thumbnail: `file:${POSTER}`,
          },
        },
      },
    };
  }

  it("swaps file refs under media keys for their URLs", () => {
    const resolved = resolveMedia(draft(), media);
    expect(resolved.testimonials.items[0].photo).toBe(
      "blob:http://localhost/photo",
    );
    expect(resolved.how_it_works.find.video.video).toBe(
      "https://cdn.example.com/video.mp4",
    );
  });

  it("leaves refs with no URL, and shipped paths, as they are", () => {
    const resolved = resolveMedia(draft(), media);
    expect(resolved.testimonials.items[1].photo).toBe(`file:${UNKNOWN}`);
    expect(resolved.how_it_works.find.video.thumbnail).toBe(`file:${POSTER}`);
    expect(
      resolveMedia({ photo: "/assets/avatar-demo/tutor/tutor1.png" }, media),
    ).toEqual({
      photo: "/assets/avatar-demo/tutor/tutor1.png",
    });
  });

  it("does not change the value it was given", () => {
    const value = draft();
    const before = JSON.stringify(value);
    const resolved = resolveMedia(value, media);
    expect(JSON.stringify(value)).toBe(before);
    expect(resolved).not.toBe(value);
    expect(resolved.how_it_works).not.toBe(value.how_it_works);
  });

  it("does not treat a file ref outside a media key as media", () => {
    expect(
      resolveMedia({ name: `file:${PHOTO}`, photo: `file:${PHOTO}` }, media),
    ).toEqual({
      name: `file:${PHOTO}`,
      photo: "blob:http://localhost/photo",
    });
  });
});

describe("mediaRefIds", () => {
  it("collects the file ids under media keys, at any depth", () => {
    const value = {
      items: [{ photo: "file:11111111-1111-4111-8111-111111111111" }],
      nested: { video: { video: "file:22222222-2222-4222-8222-222222222222" } },
      note: "file:33333333-3333-4333-8333-333333333333",
    };
    expect([...mediaRefIds(value)].sort()).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });
});

const STORY_ID = "7d2a6f1e-3b4c-4d5e-8f60-718293a4b5c6";
const TUTOR_VIDEO_ID = "1b9c8d7e-6f5a-4b3c-8d2e-0f1a2b3c4d5e";
const PHOTO_ID = "9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";

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

describe("cardFromSource", () => {
  it("fills a testimonial from a student story, without a video key", () => {
    const card = cardFromSource("testimonials", submission());
    expect(card).toEqual({
      name: "Ayesha Rahman",
      role: "Student",
      photo: `file:${PHOTO_ID}`,
      quote: "Clear and patient.",
      comment: "The tutor explained every step.",
      source: { kind: "story", id: STORY_ID },
    });
    expect(card).not.toHaveProperty("video");
  });

  it("labels a tutor author as Tutor and keeps a video clip", () => {
    const card = cardFromSource(
      "testimonials",
      submission({
        role: "TUTOR",
        videoRef: `file:${TUTOR_VIDEO_ID}`,
      }),
    );
    expect(card.role).toBe("Tutor");
    expect(card.video).toBe(`file:${TUTOR_VIDEO_ID}`);
  });

  it("leaves empty fields empty when the submission has none", () => {
    const card = cardFromSource(
      "testimonials",
      submission({ headline: null, body: null, imageRef: null }),
    );
    expect(card).toMatchObject({ quote: "", comment: "", photo: "" });
  });

  it("makes a comment card from a tutor story", () => {
    const card = cardFromSource("showcase", submission());
    expect(card).toEqual({
      kind: "comment",
      name: "Ayesha Rahman",
      subject: "Physics",
      thumbnail: `file:${PHOTO_ID}`,
      university: "BRAC University",
      comment: "The tutor explained every step.",
      source: { kind: "story", id: STORY_ID },
    });
  });

  it("makes a video card from a tutor video", () => {
    const card = cardFromSource(
      "showcase",
      submission({
        source: { kind: "tutor_video", id: TUTOR_VIDEO_ID },
        imageRef: null,
        videoRef: `file:${TUTOR_VIDEO_ID}`,
        subjectHint: null,
      }),
    );
    expect(card).toEqual({
      kind: "video",
      name: "Ayesha Rahman",
      subject: "",
      thumbnail: "",
      video: `file:${TUTOR_VIDEO_ID}`,
      source: { kind: "tutor_video", id: TUTOR_VIDEO_ID },
    });
  });
});

describe("sourceKey and sourceOwners", () => {
  it("keys a source by kind and id", () => {
    expect(sourceKey({ kind: "story", id: STORY_ID })).toBe(
      `story:${STORY_ID}`,
    );
  });

  it("maps each uploaded file to the submission it came from", () => {
    expect(sourceOwners([submission()])).toEqual({
      [PHOTO_ID]: "Ayesha Rahman",
    });
  });
});

describe("agreedText", () => {
  it("shows the consent day in Dhaka time", () => {
    expect(agreedText("2026-11-18T10:00:00.000Z")).toBe("Agreed 18 Nov 2026");
  });
});
