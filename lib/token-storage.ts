import type { Tokens } from "./api";

// Kept apart from lib/api so the draft store can check the session without a circular import.
export const STORAGE_KEY = "auth_tokens";

export function getStoredTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}
