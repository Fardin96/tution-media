"use server";

import { updateTag } from "next/cache";
import { API_URL } from "./api";
import { SITE_CONTENT_TAG } from "./site-content.server";

/**
 * Called by the admin editor after a save so the landing picks the change up at once rather
 * than within the 30-minute revalidate window. The API decides who may edit, so the call is
 * made with the admin's bearer token; the session cookie is unsigned and is not trusted here.
 * Returns false, and leaves the cache alone, when the caller is not an admin.
 */
export async function refreshSiteContent(
  accessToken: string,
): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/v1/admin/site-content`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return false;
  updateTag(SITE_CONTENT_TAG);
  return true;
}

/**
 * Called after a user's own change takes a card off the landing: a story withdrawn, a teaching
 * video unticked for the home page. Those users are not admins, so the bearer token is checked
 * against GET /api/v1/me instead, and only a valid token expires the landing cache.
 * Returns false, and leaves the cache alone, when the token is not valid.
 */
export async function refreshSiteContentForUser(
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
  updateTag(SITE_CONTENT_TAG);
  return true;
}
