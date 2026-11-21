"use server";

import { updateTag } from "next/cache";
import { API_URL } from "./api";
import { SITE_CONTENT_TAG } from "./site-content.server";

/**
 * Called by the admin editor after a save so the landing picks the change up at once rather
 * than within the 5-minute revalidate window. The API decides who may edit, so the call is
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
