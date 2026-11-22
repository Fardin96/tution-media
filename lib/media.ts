/**
 * Prefix of the API's public R2 bucket (same value as the API's R2_PUBLIC_URL_PREFIX). It is
 * the only remote origin next/image may optimize; next.config.ts builds remotePatterns from it.
 */
export const MEDIA_URL_PREFIX = (
  process.env.NEXT_PUBLIC_MEDIA_URL_PREFIX ?? ""
).replace(/\/+$/, "");

/**
 * True when next/image may optimize `src`: a local file, or a public (unsigned) file in the
 * media bucket. Signed links expire within the hour and change on every fetch, so they stay
 * unoptimized; so do blob: previews and every other host.
 */
export function canOptimizeImage(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  if (!MEDIA_URL_PREFIX || !src.startsWith(`${MEDIA_URL_PREFIX}/`)) {
    return false;
  }
  return !/[?&]X-Amz-/i.test(src);
}
