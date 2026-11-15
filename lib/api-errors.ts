import { ApiError, type ApiIssue } from "./profile";

// Copy of ERROR_CODES in tuition-api/src/lib/errors.ts. Keep the two in sync.
export const ERROR_CODES = {
  ValidationError: "VALIDATION_ERROR",
  Unauthorized: "UNAUTHORIZED",
  Forbidden: "FORBIDDEN",
  NotFound: "NOT_FOUND",
  NotImplemented: "NOT_IMPLEMENTED",
  RateLimited: "RATE_LIMITED",
  InternalError: "INTERNAL_ERROR",
  ProfileExists: "PROFILE_EXISTS",
  PhoneInUse: "PHONE_IN_USE",
  WhatsappInUse: "WHATSAPP_IN_USE",
  RequirementLimitReached: "REQUIREMENT_LIMIT_REACHED",
  RequirementIsDefault: "REQUIREMENT_IS_DEFAULT",
  RequirementInUse: "REQUIREMENT_IN_USE",
  RequirementArchived: "REQUIREMENT_ARCHIVED",
  RequirementHasNoSubjects: "REQUIREMENT_NO_SUBJECTS",
  RequirementLosesLastSubject: "REQUIREMENT_LOSES_LAST_SUBJECT",
  InvalidRequirement: "INVALID_REQUIREMENT",
  InvalidSubjectOrZone: "INVALID_SUBJECT_OR_ZONE",
  AreaOutsideCity: "AREA_OUTSIDE_CITY",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const KNOWN_CODES: readonly string[] = Object.values(ERROR_CODES);

function countOf(details: ApiError["details"], key: string): number | null {
  const value = details?.[key];
  return Array.isArray(value) ? value.length : null;
}

const MESSAGES: Record<ErrorCode, string | ((err: ApiError) => string)> = {
  VALIDATION_ERROR: "Some fields need fixing. Check the form and try again.",
  UNAUTHORIZED: "Your session has expired. Sign in again.",
  FORBIDDEN: "You don't have access to this.",
  NOT_FOUND: "We couldn't find that. It may have been deleted.",
  NOT_IMPLEMENTED: "This isn't available yet.",
  RATE_LIMITED: "Too many requests. Wait a minute and try again.",
  INTERNAL_ERROR: "Something went wrong on our side. Try again in a moment.",
  PROFILE_EXISTS: "You already have a tutor profile.",
  PHONE_IN_USE: "Phone number is already in use, please use a different one.",
  WHATSAPP_IN_USE:
    "WhatsApp number is already in use, please use a different one.",
  REQUIREMENT_LIMIT_REACHED:
    "You can have up to 10 active requirement sets. Archive one first.",
  REQUIREMENT_IS_DEFAULT:
    "You can't archive your default set. Make another set the default first.",
  REQUIREMENT_IN_USE: (err) => {
    const n = countOf(err.details, "packageIds");
    if (!n) {
      return "This set is used by open packages. Move them to another set first.";
    }
    if (n === 1) {
      return "This set is used by 1 open package. Move it to another set first.";
    }
    return `This set is used by ${n} open packages. Move them to another set first.`;
  },
  REQUIREMENT_ARCHIVED: "Restore this set before making it the default.",
  REQUIREMENT_NO_SUBJECTS:
    "Add at least one subject to this set before restoring it.",
  REQUIREMENT_LOSES_LAST_SUBJECT: (err) => {
    const n = countOf(err.details, "requirementIds");
    if (!n) {
      return "Removing this subject would leave a requirement set with no subjects.";
    }
    if (n === 1) {
      return "Removing this subject would leave 1 requirement set with no subjects.";
    }
    return `Removing this subject would leave ${n} requirement sets with no subjects.`;
  },
  INVALID_REQUIREMENT: "Check the level, group and time range.",
  INVALID_SUBJECT_OR_ZONE: "Pick only subjects and zones from your profile.",
  AREA_OUTSIDE_CITY:
    "Some areas aren't in your saved city. Pick areas in your city.",
};

/** User-facing copy for a known API error code, or undefined when there is none. */
export function errorCodeMessage(err: unknown): string | undefined {
  if (!(err instanceof ApiError) || !err.code) return undefined;
  if (!KNOWN_CODES.includes(err.code)) return undefined;
  const entry = MESSAGES[err.code as ErrorCode];
  return typeof entry === "function" ? entry(err) : entry;
}

export function isRateLimit(err: unknown): boolean {
  return err instanceof ApiError && err.status === 429;
}

/** Maps zod issues to form fields, keeping the first message per field. */
export function mapServerIssuesToFields<K extends string = string>(
  issues: ApiIssue[] | undefined,
): Partial<Record<K, string>> {
  const out: Record<string, string> = {};
  if (!issues) return out as Partial<Record<K, string>>;
  for (const issue of issues) {
    const path = [...issue.path];
    if (
      path.length > 0 &&
      (path[0] === "body" || path[0] === "query" || path[0] === "params")
    ) {
      path.shift();
    }
    if (path.length === 0) continue;
    const key = String(path[0]);
    if (!(key in out)) out[key] = issue.message;
  }
  return out as Partial<Record<K, string>>;
}
