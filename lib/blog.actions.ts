"use server";

import { updateTag } from "next/cache";
import { API_URL } from "./api";

/**
 * Called by the admin blog after a save so the public blog picks the change up at once rather
 * than within the 5-minute revalidate window. The API decides who may write posts, so the call
 * is made with the admin's bearer token; the session cookie is unsigned and is not trusted here.
 * The check reads the admin list with the smallest page size. Returns false, and leaves the
 * cache alone, when the caller is not an admin.
 */
export async function refreshBlog(accessToken: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/v1/admin/blog?limit=1`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return false;
  updateTag("blog");
  return true;
}
