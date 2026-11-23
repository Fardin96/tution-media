// Profile photos. The browser crops a picked photo to a square and re-encodes it before upload,
// so the stored file is small and carries no EXIF or GPS data.

/** Side of the stored square, in pixels. Shown at 128 CSS px at most, so 4x screens stay sharp. */
export const AVATAR_PX = 512;
/** Below this the photo looks soft at avatar sizes, so it is refused. */
export const MIN_AVATAR_SIDE = 128;

export const UNSUPPORTED_PHOTO =
  "This photo format isn't supported. Choose a JPG, PNG or WebP.";
export const SMALL_PHOTO = "Choose a photo at least 128 × 128 pixels.";

/** A photo the browser could not prepare. The message is for the user. */
export class PhotoError extends Error {}

/** Google sign-in pictures. The API returns one as the fallback when no photo was uploaded. */
export function isGoogleAvatar(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "googleusercontent.com" ||
      hostname.endsWith(".googleusercontent.com")
    );
  } catch {
    return false;
  }
}

/** True when the avatar is the user's own upload. The API does not say, so the host decides. */
export function hasUploadedAvatar(
  avatarUrl: string | null | undefined,
): boolean {
  return !!avatarUrl && !isGoogleAvatar(avatarUrl);
}

/** The largest centred square of a width x height image. */
export function avatarCrop(width: number, height: number) {
  const side = Math.min(width, height);
  return { side, sx: (width - side) / 2, sy: (height - side) / 2 };
}

/**
 * Decodes a picked photo (honouring its rotation), crops it to a centred square and encodes it.
 * Throws PhotoError with the message to show when the format or size is refused.
 */
export async function preparePhoto(file: Blob): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError(UNSUPPORTED_PHOTO);
  }
  try {
    if (bitmap.width < MIN_AVATAR_SIDE || bitmap.height < MIN_AVATAR_SIDE) {
      throw new PhotoError(SMALL_PHOTO);
    }
    return await renderSquare(bitmap);
  } finally {
    bitmap.close();
  }
}

async function renderSquare(bitmap: ImageBitmap): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot prepare photos.");
  const { side, sx, sy } = avatarCrop(bitmap.width, bitmap.height);
  // Drawing onto a canvas is what drops EXIF and GPS data from the stored file.
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);

  const webp = await toBlob(canvas, "image/webp", 0.85);
  if (webp && webp.type === "image/webp") {
    return new File([webp], "avatar.webp", { type: "image/webp" });
  }
  // Some browsers cannot encode WebP and return a PNG or nothing; JPEG is the fallback.
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("This browser cannot prepare photos.");
  return new File([jpeg], "avatar.jpg", { type: "image/jpeg" });
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
