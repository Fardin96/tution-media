"use server";

import { updateTag } from "next/cache";
import { API_URL } from "./api";

/** Tutor profile ids as the API issues them. Anything else is refused before it reaches a tag. */
const TUTOR_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Called after a tutor saves their own profile so the public page at /tutors/[id] shows the change
 * at once rather than within its 60-second revalidate window. The id is never taken from the
 * caller: the bearer token is checked against GET /api/v1/me, and the tutor's own profile id is
 * read from that response (the same id the public page is keyed by). Returns false, and leaves
 * the cache alone, when the token is not valid, the account has no tutor profile, or the id is
 * malformed.
 */
export async function refreshMyTutorProfile(
  accessToken: string,
): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/v1/me`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return false;
  let id: unknown;
  try {
    const body = (await res.json()) as {
      account?: { tutor?: { id?: unknown } };
    };
    id = body.account?.tutor?.id;
  } catch {
    return false;
  }
  if (typeof id !== "string" || !TUTOR_ID.test(id)) return false;
  updateTag(`tutor:${id}`);
  return true;
}

/**
 * Called after an admin changes what a public tutor profile shows: a video, a review, an ID
 * decision, an account block. Admin moderation is rare and the cache is short, so every cached
 * tutor profile is expired at once. The API decides who may do this, so the call is made with
 * the admin's bearer token; the session cookie is unsigned and is not trusted here. The check
 * reads the admin video queue with the smallest page size. Returns false, and leaves the cache
 * alone, when the caller is not an admin.
 */
export async function refreshTutorProfilesAsAdmin(
  accessToken: string,
): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/v1/admin/videos?limit=1`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return false;
  updateTag("tutors");
  return true;
}
