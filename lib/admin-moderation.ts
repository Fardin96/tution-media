import type { Schemas } from "./api-client";

// Shared by the admin upload decisions: verifications, videos, file removal and upload blocks.

export type UploadFlags = Schemas["UploadFlags"];

/** Matches the server: three issues in 30 days shows the repeated-problems warning. */
export const REPEAT_ISSUE_THRESHOLD = 3;
export const ISSUE_WINDOW_DAYS = 30;

const NOTE_MIN = 3;
const NOTE_MAX = 500;

/**
 * The note field's error, or undefined. A required note (rejections, removals, blocks) must have
 * 3 to 500 characters; an optional one may be empty.
 */
export function validateReviewNote(
  text: string,
  required: boolean,
): string | undefined {
  const note = text.trim();
  if (note === "") return required ? "Write a note explaining why." : undefined;
  if (note.length < NOTE_MIN) return "Write at least 3 characters.";
  if (note.length > NOTE_MAX) return "Keep it under 500 characters.";
  return undefined;
}

/** "2 issues in 30 days", or null when there are none. */
export function issueText(recentIssues: number): string | null {
  if (recentIssues <= 0) return null;
  return `${recentIssues} ${recentIssues === 1 ? "issue" : "issues"} in ${ISSUE_WINDOW_DAYS} days`;
}

/** True at the repeated-problems threshold. */
export function repeatedIssues(recentIssues: number): boolean {
  return recentIssues >= REPEAT_ISSUE_THRESHOLD;
}

/** Where an admin reviews one account's upload history and block. */
export function uploadHistoryHref(accountId: string): string {
  return `/dashboard/admin/accounts/${accountId}#uploads`;
}
