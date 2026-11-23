import { describe, expect, it } from "vitest";
import { fuzzyScore, MIN_SCORE, searchEntries } from "@/lib/fuzzy";

type Item = { title: string; keywords: string[] };

const ITEMS: Item[] = [
  {
    title: "Where it's stuck",
    keywords: ["bottleneck", "funnel", "stuck", "drop-off"],
  },
  { title: "Monthly active users", keywords: ["mau", "active"] },
  { title: "Fees over time", keywords: ["revenue", "payments"] },
  { title: "Sign-ups", keywords: [] },
];

const fields = (e: Item) => ({ title: e.title, extra: e.keywords });

describe("fuzzyScore", () => {
  it("returns null for an empty query", () => {
    expect(fuzzyScore("", "Sign-ups")).toBeNull();
    expect(fuzzyScore("   ", "Sign-ups")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(fuzzyScore("zzzz", "Monthly active users")).toBeNull();
  });

  it("ignores case and diacritics", () => {
    expect(fuzzyScore("SIGN", "Sign-ups")).not.toBeNull();
    expect(fuzzyScore("sígn", "Sign-ups")).not.toBeNull();
  });

  it("reports ranges in the original text for an exact match", () => {
    const m = fuzzyScore("sígn", "Sign-ups");
    expect(m?.ranges).toEqual([[0, 4]]);
  });

  it("scores exact substrings above subsequence matches", () => {
    const exact = fuzzyScore("active", "Monthly active users");
    const subseq = fuzzyScore("mau", "Monthly active users");
    expect(exact!.score).toBeGreaterThan(subseq!.score);
  });

  it("matches a subsequence with gaps", () => {
    expect(fuzzyScore("mau", "Monthly active users")).not.toBeNull();
  });

  it("tolerates a one-character typo in a word of 4+ characters", () => {
    // "revenuw" is not a subsequence of "revenue", so only the typo path matches.
    const m = fuzzyScore("revenuw", "revenue");
    expect(m).not.toBeNull();
    expect(m!.ranges).toEqual([[0, 7]]);
  });

  it("ranks typo matches below subsequence matches", () => {
    const typo = fuzzyScore("revnue", "revenue")!;
    const subseq = fuzzyScore("rev", "Monthly active users, review")!;
    expect(subseq.score).toBeGreaterThan(typo.score);
  });

  it("requires exact words for tokens shorter than 4", () => {
    expect(fuzzyScore("ab", "axb")).not.toBeNull(); // subsequence still works
    expect(fuzzyScore("zq", "Sign-ups")).toBeNull();
  });
});

describe("searchEntries", () => {
  it("returns nothing for an empty query", () => {
    expect(searchEntries("", ITEMS, fields)).toEqual([]);
  });

  it("finds Monthly active users first for mau", () => {
    const results = searchEntries("mau", ITEMS, fields);
    expect(results[0].entry.title).toBe("Monthly active users");
  });

  it("finds Fees over time for the typo revnue via the keyword", () => {
    const results = searchEntries("revnue", ITEMS, fields);
    expect(results[0].entry.title).toBe("Fees over time");
  });

  it("finds Where it's stuck for wher stuck", () => {
    const results = searchEntries("wher stuck", ITEMS, fields);
    expect(results[0].entry.title).toBe("Where it's stuck");
  });

  it("matches Sign-ups for SIGN and sígn", () => {
    expect(searchEntries("SIGN", ITEMS, fields)[0].entry.title).toBe(
      "Sign-ups",
    );
    expect(searchEntries("sígn", ITEMS, fields)[0].entry.title).toBe(
      "Sign-ups",
    );
  });

  it("returns no results for zzzz", () => {
    expect(searchEntries("zzzz", ITEMS, fields)).toEqual([]);
  });

  it("ranks a title match above a keyword-only match", () => {
    const entries: Item[] = [
      { title: "Other page", keywords: ["fees"] },
      { title: "Fees over time", keywords: [] },
    ];
    const results = searchEntries("fees", entries, fields);
    expect(results[0].entry.title).toBe("Fees over time");
  });

  it("keeps input order on ties", () => {
    const entries: Item[] = [
      { title: "Alpha sign", keywords: [] },
      { title: "Beta sign", keywords: [] },
    ];
    const results = searchEntries("sign", entries, fields);
    expect(results.map((r) => r.entry.title)).toEqual([
      "Alpha sign",
      "Beta sign",
    ]);
  });

  it("reports title ranges only", () => {
    const results = searchEntries("revenue", ITEMS, fields);
    expect(results[0].ranges).toEqual([]);
  });

  it("caps results at the limit", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      title: `Sign ${i}`,
      keywords: [],
    }));
    expect(searchEntries("sign", many, fields)).toHaveLength(8);
    expect(searchEntries("sign", many, fields, 3)).toHaveLength(3);
  });

  it("drops entries below MIN_SCORE", () => {
    expect(MIN_SCORE).toBeGreaterThan(0);
    const results = searchEntries("zzzz", ITEMS, fields);
    expect(results.every((r) => r.score >= MIN_SCORE)).toBe(true);
  });
});
