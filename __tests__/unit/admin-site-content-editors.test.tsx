import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { EDITORS, SeoEditor } from "@/components/admin/site-content/editors";
import {
  FaqEditor,
  FooterEditor,
  HowItWorksEditor,
  ShowcaseEditor,
  TestimonialsEditor,
} from "@/components/admin/site-content/list-editors";
import { SITE_CONTENT_DEFAULTS, type SiteContent } from "@/lib/site-content";

const DEFAULTS = SITE_CONTENT_DEFAULTS;

/** The last value an editor sent up. */
function lastValue<T>(onChange: ReturnType<typeof vi.fn>): T {
  const calls = onChange.mock.calls;
  return calls[calls.length - 1][0] as T;
}

describe("editor registry", () => {
  it.each([
    "testimonials",
    "showcase",
    "how_it_works",
    "faq",
    "footer",
  ] as const)("registers an editor for %s", (key) => {
    expect(EDITORS[key]).toBeDefined();
  });
});

describe("TestimonialsEditor", () => {
  it("renders the defaults with the word and character hints", () => {
    render(
      <TestimonialsEditor
        value={DEFAULTS.testimonials}
        onChange={vi.fn()}
        errors={{}}
      />,
    );
    expect(screen.getAllByLabelText("Quote")[0]).toHaveValue(
      DEFAULTS.testimonials.items[0].quote,
    );
    expect(
      screen.getAllByText("Shown on the front of the card")[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Shown when the card is flipped")[0],
    ).toBeInTheDocument();
  });

  it("sends the comment edit under the right item", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TestimonialsEditor
        value={DEFAULTS.testimonials}
        onChange={onChange}
        errors={{}}
      />,
    );
    await user.type(screen.getAllByLabelText("Comment")[1], "!");
    const next = lastValue<SiteContent["testimonials"]>(onChange);
    expect(next.items[1].comment).toBe(
      `${DEFAULTS.testimonials.items[1].comment}!`,
    );
    expect(next.items[0]).toEqual(DEFAULTS.testimonials.items[0]);
  });

  it("shows the error for a comment over 90 words on that card", () => {
    const comment = Array(91).fill("word").join(" ");
    render(
      <TestimonialsEditor
        value={{
          ...DEFAULTS.testimonials,
          items: [{ ...DEFAULTS.testimonials.items[0], comment }],
        }}
        onChange={vi.fn()}
        errors={{ "items.0.comment": "At most 90 words" }}
      />,
    );
    expect(screen.getByText("At most 90 words")).toBeInTheDocument();
  });
});

describe("ShowcaseEditor", () => {
  it("switching a video card to comment keeps name, subject and poster and clears the comment fields", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ShowcaseEditor
        value={DEFAULTS.showcase}
        onChange={onChange}
        errors={{}}
      />,
    );
    await user.click(screen.getAllByRole("radio", { name: "Comment" })[0]);
    const first = lastValue<SiteContent["showcase"]>(onChange).items[0];
    expect(first).toEqual({
      kind: "comment",
      name: DEFAULTS.showcase.items[0].name,
      subject: DEFAULTS.showcase.items[0].subject,
      thumbnail: DEFAULTS.showcase.items[0].thumbnail,
      university: "",
      comment: "",
    });
  });

  it("switching a comment card to video starts on the first video", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value = {
      ...DEFAULTS.showcase,
      items: [
        {
          kind: "comment" as const,
          name: "Ayesha",
          subject: "Physics",
          thumbnail: "/assets/avatar-demo/tutor/tutor3.png",
          university: "BRAC University",
          comment: "Clear and patient.",
        },
      ],
    };
    render(<ShowcaseEditor value={value} onChange={onChange} errors={{}} />);
    await user.click(screen.getByRole("radio", { name: "Video" }));
    const card = lastValue<SiteContent["showcase"]>(onChange).items[0];
    expect(card).toEqual({
      kind: "video",
      name: "Ayesha",
      subject: "Physics",
      thumbnail: "/assets/avatar-demo/tutor/tutor3.png",
      video: "/videos/how-to-guardians.mp4",
    });
  });
});

describe("HowItWorksEditor", () => {
  it("changes a step icon through the native select", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <HowItWorksEditor
        value={DEFAULTS.how_it_works}
        onChange={onChange}
        errors={{}}
      />,
    );
    const [icon] = screen.getAllByLabelText("Icon");
    await user.selectOptions(icon, "search");
    const next = lastValue<SiteContent["how_it_works"]>(onChange);
    expect(next.find.steps[0].icon).toBe("search");
    expect(next.become).toEqual(DEFAULTS.how_it_works.become);
  });

  it("titles each group with its tab label, or a fallback when blank", () => {
    render(
      <HowItWorksEditor
        value={{
          ...DEFAULTS.how_it_works,
          become: { ...DEFAULTS.how_it_works.become, label: "  " },
        }}
        onChange={vi.fn()}
        errors={{}}
      />,
    );
    expect(
      screen.getByRole("heading", { name: DEFAULTS.how_it_works.find.label }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Become a Tutor tab" }),
    ).toBeInTheDocument();
  });
});

describe("FaqEditor", () => {
  it("sends an answer edit with the other items unchanged", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FaqEditor value={DEFAULTS.faq} onChange={onChange} errors={{}} />);
    await user.type(screen.getAllByLabelText("Answer")[1], "!");
    const next = lastValue<SiteContent["faq"]>(onChange);
    expect(next.items[1].answer).toBe(`${DEFAULTS.faq.items[1].answer}!`);
    expect(next.items[0]).toEqual(DEFAULTS.faq.items[0]);
    expect(next.openIndex).toBe(DEFAULTS.faq.openIndex);
  });

  it("sets Starts open to None when the open question is removed", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<SiteContent["faq"]>(DEFAULTS.faq);
      return <FaqEditor value={value} onChange={setValue} errors={{}} />;
    }
    render(<Harness />);
    const open = DEFAULTS.faq.openIndex as number;
    expect(screen.getByLabelText("Starts open")).toHaveValue(String(open));

    await user.click(
      screen.getByRole("button", {
        name: `Remove: ${DEFAULTS.faq.items[open].question}`,
      }),
    );
    expect(screen.getByLabelText("Starts open")).toHaveValue("");
  });

  it("keeps Starts open on the same question after an earlier one is removed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FaqEditor
        value={{ ...DEFAULTS.faq, openIndex: 3 }}
        onChange={onChange}
        errors={{}}
      />,
    );
    await user.click(
      screen.getByRole("button", {
        name: `Remove: ${DEFAULTS.faq.items[0].question}`,
      }),
    );
    const next = lastValue<SiteContent["faq"]>(onChange);
    expect(next.openIndex).toBe(2);
    expect(next.items[2]).toEqual(DEFAULTS.faq.items[3]);
  });

  it("writes the new open index in the same change as a move", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FaqEditor
        value={{ ...DEFAULTS.faq, openIndex: 1 }}
        onChange={onChange}
        errors={{}}
      />,
    );
    await user.click(
      screen.getByRole("button", {
        name: `Move down: ${DEFAULTS.faq.items[0].question}`,
      }),
    );
    const next = lastValue<SiteContent["faq"]>(onChange);
    expect(next.openIndex).toBe(0);
    expect(next.items[1]).toEqual(DEFAULTS.faq.items[0]);
  });

  it("offers each question in Starts open by number and first words", () => {
    render(
      <FaqEditor
        value={{ ...DEFAULTS.faq, openIndex: null }}
        onChange={vi.fn()}
        errors={{}}
      />,
    );
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("None");
    expect(options[1]).toHaveTextContent(
      `Question 1: ${DEFAULTS.faq.items[0].question.slice(0, 40)}`,
    );
  });
});

describe("FooterEditor", () => {
  it("unchecking a platform removes it and keeps the others in order", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FooterEditor value={DEFAULTS.footer} onChange={onChange} errors={{}} />,
    );
    await user.click(screen.getByRole("switch", { name: "Show Instagram" }));
    const next = lastValue<SiteContent["footer"]>(onChange);
    expect(next.socials.map((row) => row.platform)).toEqual(
      DEFAULTS.footer.socials
        .map((row) => row.platform)
        .filter((platform) => platform !== "instagram"),
    );
  });

  it("checking a platform adds it with an empty link in platform order", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value = {
      ...DEFAULTS.footer,
      socials: DEFAULTS.footer.socials.slice(1),
    };
    render(<FooterEditor value={value} onChange={onChange} errors={{}} />);
    const link = screen.getByLabelText("Instagram link");
    expect(link).toBeDisabled();
    await user.click(screen.getByRole("switch", { name: "Show Instagram" }));
    const next = lastValue<SiteContent["footer"]>(onChange);
    expect(next.socials[0]).toEqual({ platform: "instagram", href: "" });
    expect(next.socials).toHaveLength(4);
  });

  it("enables the link input only for a shown platform", () => {
    render(
      <FooterEditor
        value={{
          ...DEFAULTS.footer,
          socials: DEFAULTS.footer.socials.slice(1),
        }}
        onChange={vi.fn()}
        errors={{}}
      />,
    );
    expect(screen.getByLabelText("Instagram link")).toBeDisabled();
    expect(screen.getByLabelText("Telegram link")).toBeEnabled();
  });

  it("has three fixed link columns and no add or remove column control", () => {
    render(
      <FooterEditor value={DEFAULTS.footer} onChange={vi.fn()} errors={{}} />,
    );
    expect(screen.getAllByLabelText(/^Column \d heading$/)).toHaveLength(3);
    expect(
      screen.queryByRole("button", { name: /column/i }),
    ).not.toBeInTheDocument();
  });

  it("disables Add link at eight links in a column", () => {
    const extra = Array.from(
      { length: 8 - DEFAULTS.footer.columns[0].links.length },
      (_, i) => ({
        label: `Extra ${i + 1}`,
        href: "/blog",
      }),
    );
    const value = {
      ...DEFAULTS.footer,
      columns: [
        {
          ...DEFAULTS.footer.columns[0],
          links: [...DEFAULTS.footer.columns[0].links, ...extra],
        },
        DEFAULTS.footer.columns[1],
        DEFAULTS.footer.columns[2],
      ] as SiteContent["footer"]["columns"],
    };
    render(<FooterEditor value={value} onChange={vi.fn()} errors={{}} />);
    const [addFirst, addSecond] = screen.getAllByRole("button", {
      name: "Add link",
    });
    expect(addFirst).toBeDisabled();
    expect(addSecond).toBeEnabled();
  });

  it("reads a link error at its column and row", () => {
    render(
      <FooterEditor
        value={DEFAULTS.footer}
        onChange={vi.fn()}
        errors={{
          "columns.1.links.0.href": "Use a link starting with https://",
        }}
      />,
    );
    expect(
      screen.getAllByText("Use a link starting with https://").length,
    ).toBeGreaterThan(0);
  });
});

describe("SeoEditor", () => {
  it("does not repeat the search snippet; the preview shows it", () => {
    render(<SeoEditor value={DEFAULTS.seo} onChange={vi.fn()} errors={{}} />);
    expect(screen.queryByText("Search result")).not.toBeInTheDocument();
    expect(screen.queryByText("Masters Hub")).not.toBeInTheDocument();
  });
});

describe("TestimonialsEditor video and submission cards", () => {
  const FIRST = DEFAULTS.testimonials.items[0];
  const SOURCE = {
    kind: "story" as const,
    id: "7d2a6f1e-3b4c-4d5e-8f60-718293a4b5c6",
  };

  function withItem(item: SiteContent["testimonials"]["items"][number]) {
    return { ...DEFAULTS.testimonials, items: [item] };
  }

  it("adds a built-in video, which the field then shows", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TestimonialsEditor
        value={withItem(FIRST)}
        onChange={onChange}
        errors={{}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add video" }));
    expect(
      lastValue<SiteContent["testimonials"]>(onChange).items[0].video,
    ).toBe("/videos/how-to-guardians.mp4");
  });

  it("removes the video key, not its value, when the video is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TestimonialsEditor
        value={withItem({ ...FIRST, video: "/videos/tutor1.mp4" })}
        onChange={onChange}
        errors={{}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove video" }));
    const next = lastValue<SiteContent["testimonials"]>(onChange).items[0];
    expect(next).not.toHaveProperty("video");
    expect(next.name).toBe(FIRST.name);
  });

  it("tags a submission card, explains it, and shows a server error on it", () => {
    render(
      <TestimonialsEditor
        value={withItem({ ...FIRST, name: "Ayesha Rahman", source: SOURCE })}
        onChange={vi.fn()}
        errors={{ "items.0.source": "This submission is no longer approved." }}
      />,
    );
    expect(
      screen.getByText("From Ayesha Rahman's submission"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "If they delete it, or an admin rejects it, this card comes off the home page.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This submission is no longer approved.",
    );
  });
});
