import type { AreaOption } from "./areas";
import { searchEntries, type Range } from "./fuzzy";
import type { Option } from "./profile";

/** What the landing search box can pick for a place: one area, or a whole district. */
export type PlacePick =
  | { kind: "area"; id: number; name: string; district: string }
  | { kind: "district"; name: string };

export type Suggestion<T> = { entry: T; ranges: Range[]; score: number };

/** Longest text the search box keeps; longer input is cut, never sent whole. */
export const SEARCH_TEXT_MAX = 100;

// searchEntries doubles a title score, and a substring hit scores at least 1000, so 2000 means
// "the name contains what was typed". Weaker (typo or scattered-letter) hits are only suggested.
const AUTO_PICK_SCORE = 2000;

// "Math tutor" and "Physics teacher" name a subject; the role word is not part of it.
const ROLE_WORDS =
  /\b(?:tutors?|teachers?|specialists?|instructors?|experts?|coach(?:es)?|class(?:es)?|tuitions?|packages?|private|home)\b/giu;

const norm = (text: string) =>
  text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

/** The subject part of what was typed: role words dropped, spaces tidied. */
export function subjectQuery(text: string): string {
  return text
    .slice(0, SEARCH_TEXT_MAX)
    .replace(ROLE_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** District names in the order the areas list gives them, once each. */
export function districtsOf(areas: AreaOption[]): string[] {
  return [...new Set(areas.map((a) => a.district))];
}

/** "Gulshan, Dhaka" for an area, "Dhaka" for a district. */
export function placeLabel(place: PlacePick): string {
  return place.kind === "area"
    ? `${place.name}, ${place.district}`
    : place.name;
}

export function suggestSubjects(
  text: string,
  subjects: Option[],
  limit = 6,
): Suggestion<Option>[] {
  const raw = text.slice(0, SEARCH_TEXT_MAX).trim();
  const fields = (s: Option) => ({ title: s.name, extra: [] });
  // The raw text first, so "Home Economics" finds that subject before the role word is dropped.
  const direct = searchEntries(raw, subjects, fields, limit);
  if (direct[0] && direct[0].score >= AUTO_PICK_SCORE) return direct;
  const query = subjectQuery(text);
  if (!query || query === raw) return direct;
  // Names written out in full in the text go first, longest first: the rule resolveSubject uses on submit.
  const inText = (s: Option) => ` ${norm(raw)} `.includes(` ${norm(s.name)} `);
  const rank = (s: Option) => (inText(s) ? s.name.length : 0);
  const stripped = searchEntries(query, subjects, fields, limit).sort(
    (a, b) => rank(b.entry) - rank(a.entry),
  );
  return stripped.length > 0 ? stripped : direct;
}

/**
 * Districts and areas for what was typed. Text after a comma narrows by district, so
 * "Gulshan, Dhaka" only offers areas in a district starting with "dhaka".
 */
export function suggestPlaces(
  text: string,
  areas: AreaOption[],
  limit = 6,
): Suggestion<PlacePick>[] {
  const [head, tail] = splitPlace(text);
  if (!head) return [];
  const entries: PlacePick[] = [
    ...districtsOf(areas).map((name) => ({ kind: "district" as const, name })),
    ...areas.map((a) => ({ kind: "area" as const, ...a })),
  ].filter(
    (p) =>
      !tail || norm(p.kind === "area" ? p.district : p.name).startsWith(tail),
  );
  return searchEntries(
    head,
    entries,
    (p) => ({ title: p.name, extra: p.kind === "area" ? [p.district] : [] }),
    limit,
  );
}

/** The subject the text names, or null. Only an exact name or a name containing it counts. */
export function resolveSubject(
  text: string,
  subjects: Option[],
): Option | null {
  const raw = norm(text.slice(0, SEARCH_TEXT_MAX));
  if (!raw) return null;
  // A whole subject name in the text, longest first, so "physics teacher" is Physics and
  // "home economics tutor" is Home Economics, not Economics.
  const contained = subjects
    .filter((s) => ` ${raw} `.includes(` ${norm(s.name)} `))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (contained) return contained;
  const top = suggestSubjects(text, subjects, 1)[0];
  return top && top.score >= AUTO_PICK_SCORE ? top.entry : null;
}

/**
 * The area or district the text names, or null. An area name shared by two districts with no
 * district typed is ambiguous, so it resolves to nothing rather than to a guess.
 */
export function resolvePlace(
  text: string,
  areas: AreaOption[],
): PlacePick | null {
  const [head, tail] = splitPlace(text);
  if (!head) return null;
  const named = areas.filter(
    (a) => norm(a.name) === head && (!tail || norm(a.district) === tail),
  );
  if (named.length === 1) return { kind: "area", ...named[0] };
  if (named.length > 1) return null;
  const district = districtsOf(areas).find((d) => norm(d) === head);
  if (district && !tail) return { kind: "district", name: district };
  const top = suggestPlaces(text, areas, 1)[0];
  return top && top.score >= AUTO_PICK_SCORE ? top.entry : null;
}

/** ["gulshan", "dhaka"] from "Gulshan, Dhaka"; a leading comma (", Dhaka") moves the tail to the head. */
function splitPlace(text: string): [string, string] {
  const [head = "", ...rest] = text.slice(0, SEARCH_TEXT_MAX).split(",");
  const tail = norm(rest.join(","));
  return norm(head) ? [norm(head), tail] : [tail, ""];
}
