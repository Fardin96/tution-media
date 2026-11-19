import { ApiError, type ApiIssue } from "./profile";
import type { components } from "./api-types";

// The code list comes from tuition-api's OpenAPI document. ERROR_CODES mirrors the backend's
// constant (tuition-api/src/lib/errors.ts); the checks below fail typecheck when they drift.
export type ErrorCode = components["schemas"]["ErrorCode"];

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
  RequirementArchived: "REQUIREMENT_ARCHIVED",
  RequirementHasNoSubjects: "REQUIREMENT_NO_SUBJECTS",
  RequirementLosesLastSubject: "REQUIREMENT_LOSES_LAST_SUBJECT",
  InvalidRequirement: "INVALID_REQUIREMENT",
  InvalidSubjectOrZone: "INVALID_SUBJECT_OR_ZONE",
  AreaOutsideCity: "AREA_OUTSIDE_CITY",
  ZoneLimitReached: "ZONE_LIMIT_REACHED",
  ZoneRequestPending: "ZONE_REQUEST_PENDING",
  ZoneRequestDecided: "ZONE_REQUEST_DECIDED",
  ProfileIncomplete: "PROFILE_INCOMPLETE",
  AlreadyApplied: "ALREADY_APPLIED",
  ApplicationClosed: "APPLICATION_CLOSED",
  ListingNotOpen: "LISTING_NOT_OPEN",
  InvalidApplicationState: "INVALID_APPLICATION_STATE",
  InvalidAdminState: "INVALID_ADMIN_STATE",
  InvalidAccountState: "INVALID_ACCOUNT_STATE",
  InvalidFeeState: "INVALID_FEE_STATE",
  InvalidPaymentState: "INVALID_PAYMENT_STATE",
  PromoInvalid: "PROMO_INVALID",
  PromoCodeExists: "PROMO_CODE_EXISTS",
  RefundNotAllowed: "REFUND_NOT_ALLOWED",
  InvalidRefundState: "INVALID_REFUND_STATE",
  PackageAlreadyModerated: "PACKAGE_ALREADY_MODERATED",
  SubjectExists: "SUBJECT_EXISTS",
  AreaExists: "AREA_EXISTS",
  PaymentsDisabled: "PAYMENTS_DISABLED",
  GatewayUnavailable: "GATEWAY_UNAVAILABLE",
  StorageUnavailable: "STORAGE_UNAVAILABLE",
  FileTooLarge: "FILE_TOO_LARGE",
  UnsupportedFileType: "UNSUPPORTED_FILE_TYPE",
  UploadNotFound: "UPLOAD_NOT_FOUND",
  InvalidFile: "INVALID_FILE",
  FileInUse: "FILE_IN_USE",
  UploadLimitReached: "UPLOAD_LIMIT_REACHED",
  InvalidVerificationState: "INVALID_VERIFICATION_STATE",
  VideoAlreadyModerated: "VIDEO_ALREADY_MODERATED",
  BlogSlugExists: "BLOG_SLUG_EXISTS",
  InvalidPostState: "INVALID_POST_STATE",
  ReviewExists: "REVIEW_EXISTS",
  ReviewNotAllowed: "REVIEW_NOT_ALLOWED",
  InvalidReviewState: "INVALID_REVIEW_STATE",
  ReportExists: "REPORT_EXISTS",
  ReportNotAllowed: "REPORT_NOT_ALLOWED",
  DisputeExists: "DISPUTE_EXISTS",
  DisputeNotAllowed: "DISPUTE_NOT_ALLOWED",
  InvalidCaseState: "INVALID_CASE_STATE",
} as const satisfies Record<string, ErrorCode>;

// Fails if the generated ErrorCode union has a code that ERROR_CODES does not list.
type UnlistedCode = Exclude<
  ErrorCode,
  (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
>;
const _allCodesListed: [UnlistedCode] extends [never] ? true : UnlistedCode =
  true;
void _allCodesListed;

const KNOWN_CODES: readonly string[] = Object.values(ERROR_CODES);

// Keys the API's tutor_missing_requirements() returns, in readable form.
const MISSING_REQUIREMENT_LABELS: Record<string, string> = {
  name: "name",
  address: "address",
  location_pin: "location pin",
  area: "teaching area",
  phone_number: "phone number",
  phone_verification: "phone verification",
  default_requirement: "default set with a zone or online teaching",
  verification: "verification",
};

/** Readable name for a missing-profile key from PROFILE_INCOMPLETE details. Unknown keys fall back to their words. */
export function missingRequirementLabel(code: string): string {
  if (!code) return "";
  return MISSING_REQUIREMENT_LABELS[code] ?? code.replace(/_/g, " ");
}

function missingRequirements(details: ApiError["details"]): string[] {
  const value = details?.missing;
  if (!Array.isArray(value)) return [];
  const labels = value
    .filter((code): code is string => typeof code === "string")
    .map(missingRequirementLabel)
    .filter((label) => label !== "");
  return [...new Set(labels)];
}

function countOf(details: ApiError["details"], key: string): number | null {
  const value = details?.[key];
  return Array.isArray(value) ? value.length : null;
}

function countPhrase(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

// Keyed by the generated ErrorCode union: a new backend code needs a message or typecheck fails.
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
  REQUIREMENT_ARCHIVED: "Restore this set before making it the default.",
  REQUIREMENT_NO_SUBJECTS:
    "Add at least one subject to this set before restoring it.",
  REQUIREMENT_LOSES_LAST_SUBJECT: (err) => {
    const sets = countOf(err.details, "requirementIds") ?? 0;
    const packages = countOf(err.details, "packageIds") ?? 0;
    if (packages === 0) {
      if (sets === 0) {
        return "Removing this subject would leave a requirement set with no subjects.";
      }
      return `Removing this subject would leave ${countPhrase(sets, "requirement set", "requirement sets")} with no subjects.`;
    }
    if (sets === 0) {
      return `Removing this subject would leave ${countPhrase(packages, "package", "packages")} with no subjects.`;
    }
    return `Removing this subject would leave ${countPhrase(sets, "requirement set", "requirement sets")} and ${countPhrase(packages, "package", "packages")} with no subjects.`;
  },
  INVALID_REQUIREMENT: "Check the level, group and time range.",
  INVALID_SUBJECT_OR_ZONE: "Pick only subjects and zones from your profile.",
  AREA_OUTSIDE_CITY:
    "Some areas aren't in your saved city. Pick areas in your city.",
  ZONE_LIMIT_REACHED: "You've used all your zones. Delete one or ask for more.",
  ZONE_REQUEST_PENDING:
    "You already have a request waiting. We'll let you know when it's decided.",
  ZONE_REQUEST_DECIDED: "This request was already decided.",
  PROFILE_INCOMPLETE: (err) => {
    const missing = missingRequirements(err.details);
    if (missing.length === 0) return "Complete your profile before applying.";
    return `Finish your profile before applying: ${missing.join(", ")}.`;
  },
  ALREADY_APPLIED: "You've already applied.",
  APPLICATION_CLOSED: "This tuition is no longer taking applications.",
  LISTING_NOT_OPEN: "This listing isn't open anymore.",
  INVALID_APPLICATION_STATE:
    "This application changed. Refresh to see its current status.",
  // Admin conflicts: the server's message names the exact rule (amount still due, already blocked...).
  INVALID_ADMIN_STATE: (err) =>
    err.message || "This admin changed. Refresh to see their current status.",
  INVALID_ACCOUNT_STATE: (err) =>
    err.message || "This account changed. Refresh to see its current status.",
  INVALID_FEE_STATE: (err) =>
    err.message || "This fee changed. Refresh to see its current status.",
  INVALID_PAYMENT_STATE: (err) =>
    err.message || "This payment changed. Refresh to see its current status.",
  // The server says which rule the code broke (expired, used up, below the ৳10 minimum...).
  PROMO_INVALID: (err) => err.message || "That code can't be used on this fee.",
  PROMO_CODE_EXISTS: "A promo code with that name already exists.",
  // The server names the rule (window closed, already open, nothing left to refund...).
  REFUND_NOT_ALLOWED: (err) =>
    err.message || "This payment can't be refunded right now.",
  INVALID_REFUND_STATE: (err) =>
    err.message || "This refund changed. Refresh to see its current status.",
  PACKAGE_ALREADY_MODERATED: "Another admin already reviewed this package.",
  SUBJECT_EXISTS: "A subject with this name or slug already exists.",
  AREA_EXISTS: "An area with this name already exists in this district.",
  PAYMENTS_DISABLED:
    "Online payments are turned off right now. Try again later.",
  GATEWAY_UNAVAILABLE:
    "The payment gateway isn't responding. Try again in a few minutes.",
  STORAGE_UNAVAILABLE: "Uploads aren't available right now. Try again later.",
  // The server names the limit ("The limit is 10 MB.") and the accepted types.
  FILE_TOO_LARGE: (err) => err.message || "That file is too large.",
  UNSUPPORTED_FILE_TYPE: (err) =>
    err.message || "That file type isn't accepted here.",
  UPLOAD_NOT_FOUND: "The upload didn't finish. Try again.",
  INVALID_FILE: (err) =>
    err.message || "That file can't be used. Upload it again.",
  FILE_IN_USE: (err) => err.message || "That file is already in use.",
  UPLOAD_LIMIT_REACHED: (err) =>
    err.message || "You've reached the limit. Remove one first.",
  INVALID_VERIFICATION_STATE: (err) =>
    err.message || "This verification changed. Refresh to see its status.",
  VIDEO_ALREADY_MODERATED: "This video already has that decision.",
  BLOG_SLUG_EXISTS:
    "Another post already uses that link. Pick a different one.",
  INVALID_POST_STATE: (err) =>
    err.message || "This post changed. Refresh to see its status.",
  REVIEW_EXISTS:
    "You've already reviewed this person. Edit your review instead.",
  REVIEW_NOT_ALLOWED: (err) =>
    err.message || "You can't review this tuition yet.",
  INVALID_REVIEW_STATE: (err) =>
    err.message || "This review changed. Refresh to see it.",
  REPORT_EXISTS: "You already have an open report about this account.",
  REPORT_NOT_ALLOWED: (err) => err.message || "This account can't be reported.",
  DISPUTE_EXISTS: "You already have an open dispute on this tuition.",
  DISPUTE_NOT_ALLOWED: (err) =>
    err.message || "Only a confirmed or completed tuition can be disputed.",
  INVALID_CASE_STATE: (err) =>
    err.message || "This case changed. Refresh to see its status.",
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
