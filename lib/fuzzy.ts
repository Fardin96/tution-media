// Dependency-free fuzzy matching for the admin dashboard finder.
// Ranges are half-open [start, end) offsets into the ORIGINAL text, in code units.

export type Range = [number, number];
export type FuzzyMatch = { score: number; ranges: Range[] };

export const MIN_SCORE = 10;

const EXACT_BASE = 1000;
const SUBSEQUENCE_BASE = 100;
const SUBSEQUENCE_FLOOR = 50;
const TYPO_BASE = 10;

type Folded = {
  chars: string[];
  start: number[];
  end: number[];
};

const WORD_CHAR = /[\p{L}\p{N}]/u;

function isWordChar(c: string | undefined) {
  return c !== undefined && WORD_CHAR.test(c);
}

/** Case and diacritic folding, one code point at a time, keeping original offsets. */
function fold(text: string): Folded {
  const chars: string[] = [];
  const start: number[] = [];
  const end: number[] = [];
  let offset = 0;
  for (const original of text) {
    const folded = original
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
    for (const c of folded) {
      chars.push(c);
      start.push(offset);
      end.push(offset + original.length);
    }
    offset += original.length;
  }
  return { chars, start, end };
}

function queryTokens(query: string): string[][] {
  return fold(query.trim())
    .chars.join("")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => Array.from(token));
}

/** Merges touching or overlapping ranges so highlights render as single spans. */
function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

function exactMatch(query: string[], f: Folded): number {
  const m = query.length;
  for (let i = 0; i + m <= f.chars.length; i++) {
    let ok = true;
    for (let k = 0; k < m; k++) {
      if (f.chars[i + k] !== query[k]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

/** Best-effort subsequence alignment: each query char is matched greedily from a start position. */
function subsequenceMatch(
  query: string[],
  f: Folded,
): { score: number; positions: number[] } | null {
  let best: { score: number; positions: number[] } | null = null;
  for (let s = 0; s < f.chars.length; s++) {
    if (f.chars[s] !== query[0]) continue;
    const positions = [s];
    let p = s;
    let ok = true;
    for (let k = 1; k < query.length; k++) {
      let j = p + 1;
      while (j < f.chars.length && f.chars[j] !== query[k]) j++;
      if (j >= f.chars.length) {
        ok = false;
        break;
      }
      positions.push(j);
      p = j;
    }
    if (!ok) continue;

    let score = SUBSEQUENCE_BASE;
    positions.forEach((pos, k) => {
      if (k === 0) {
        score -= Math.min(pos, 30) * 0.5;
      } else {
        const gap = pos - positions[k - 1] - 1;
        score += gap === 0 ? 15 : -Math.min(gap, 20);
      }
      if (!isWordChar(f.chars[pos - 1]) || pos === 0) score += 20;
    });
    score = Math.max(score, SUBSEQUENCE_FLOOR);
    if (!best || score > best.score) best = { score, positions };
  }
  return best;
}

/** Levenshtein distance over code points; only used on short words. */
function editDistance(a: string[], b: string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/** Word spans [start, end) in folded char indices. */
function wordSpans(f: Folded): [number, number][] {
  const spans: [number, number][] = [];
  let i = 0;
  while (i < f.chars.length) {
    if (!isWordChar(f.chars[i])) {
      i++;
      continue;
    }
    const s = i;
    while (i < f.chars.length && isWordChar(f.chars[i])) i++;
    spans.push([s, i]);
  }
  return spans;
}

/** Each query token must match some word within one edit (tokens of 4+ chars) or exactly. */
function typoMatch(tokens: string[][], f: Folded): FuzzyMatch | null {
  const spans = wordSpans(f);
  const hit = new Set<number>();
  for (const token of tokens) {
    const allowed = token.length >= 4 ? 1 : 0;
    let found = false;
    for (let w = 0; w < spans.length; w++) {
      const [s, e] = spans[w];
      if (Math.abs(e - s - token.length) > allowed) continue;
      if (editDistance(token, f.chars.slice(s, e)) <= allowed) {
        hit.add(w);
        found = true;
        break;
      }
    }
    if (!found) return null;
  }
  const ranges: Range[] = [...hit].map((w) => {
    const [s, e] = spans[w];
    return [f.start[s], f.end[e - 1]] as Range;
  });
  return { score: TYPO_BASE + tokens.length, ranges: mergeRanges(ranges) };
}

/**
 * Scores `text` against `query`. Exact substrings score highest (word starts
 * rank higher), then subsequence matches, then per-token typo matches.
 * Returns null for an empty query or no match.
 */
export function fuzzyScore(query: string, text: string): FuzzyMatch | null {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return null;

  const f = fold(text);
  const phrase = tokens.map((t) => t.join("")).join(" ");
  const phraseChars = Array.from(phrase);

  const at = exactMatch(phraseChars, f);
  if (at >= 0) {
    const last = at + phraseChars.length - 1;
    const wordStart = !isWordChar(f.chars[at - 1]) ? 50 : 0;
    return {
      score: EXACT_BASE + wordStart,
      ranges: [[f.start[at], f.end[last]]],
    };
  }

  const flat = tokens.flat();
  const sub = subsequenceMatch(flat, f);
  if (sub) {
    const ranges = mergeRanges(
      sub.positions.map((p) => [f.start[p], f.end[p]] as Range),
    );
    return { score: sub.score, ranges };
  }

  return typoMatch(tokens, f);
}

/**
 * Ranks entries by their best field. The title counts double, so a title hit
 * beats a keyword hit of the same quality. Ties keep input order.
 */
export function searchEntries<T>(
  query: string,
  entries: T[],
  fields: (entry: T) => { title: string; extra: string[] },
  limit = 8,
): { entry: T; score: number; ranges: Range[] }[] {
  if (queryTokens(query).length === 0) return [];

  const scored: { entry: T; score: number; ranges: Range[]; index: number }[] =
    [];
  entries.forEach((entry, index) => {
    const { title, extra } = fields(entry);
    const titleMatch = fuzzyScore(query, title);
    const titleScore = titleMatch ? titleMatch.score * 2 : -Infinity;
    let extraScore = -Infinity;
    for (const text of extra) {
      const m = fuzzyScore(query, text);
      if (m && m.score > extraScore) extraScore = m.score;
    }
    const score = Math.max(titleScore, extraScore);
    if (!Number.isFinite(score) || score < MIN_SCORE) return;
    scored.push({
      entry,
      score,
      ranges: titleMatch?.ranges ?? [],
      index,
    });
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored
    .slice(0, limit)
    .map(({ entry, score, ranges }) => ({ entry, score, ranges }));
}
