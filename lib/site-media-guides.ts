// Upload guidance for each media slot on the landing page, written from the boxes the landing
// components actually render. Keep in step with the aspect-* classes in components/testimonials.tsx,
// tutor-showcase.tsx and how-it-works.tsx.

export type MediaKind = "image" | "video";

export type MediaGuide = {
  kind: MediaKind;
  /** One line: shape and minimum size. */
  shape: string;
  /** How the landing crops it, and where to keep the important part. */
  crop: string;
  /** Width / height the slot is closest to; used to warn about a very different upload. */
  ratio: number;
  /** Smallest width and height that still look sharp on a large screen. */
  minWidth: number;
  minHeight: number;
};

export type MediaSlot =
  | "testimonialPhoto"
  | "testimonialVideo"
  | "showcasePoster"
  | "showcaseVideo"
  | "howItWorksPoster"
  | "howItWorksVideo";

export const MEDIA_GUIDES: Record<MediaSlot, MediaGuide> = {
  testimonialPhoto: {
    kind: "image",
    shape: "Square or portrait, at least 1000 × 1000 px.",
    crop: "Phones show a wide 16:9 strip from the upper middle, so keep the face in the top third and centred.",
    ratio: 1,
    minWidth: 1000,
    minHeight: 1000,
  },
  testimonialVideo: {
    kind: "video",
    shape:
      "Square or landscape MP4 or WebM, at least 1080 × 1080 px, under 60 seconds.",
    crop: "Plays muted on a loop in place of the photo: a wide strip on phones, close to square on large screens. Keep faces in the centre; captions help since there is no sound.",
    ratio: 1,
    minWidth: 1080,
    minHeight: 1080,
  },
  showcasePoster: {
    kind: "image",
    shape: "Portrait 3:4, at least 922 × 1206 px.",
    crop: "The card is cut from the top, so keep the face near the top. Text cards lay the name over the bottom third.",
    ratio: 3 / 4,
    minWidth: 922,
    minHeight: 1206,
  },
  showcaseVideo: {
    kind: "video",
    shape: "Portrait 3:4 MP4 or WebM, at least 720 × 960 px, under 30 seconds.",
    crop: "Plays muted on a loop, filling a 3:4 card. Keep the speaker centred; anything near the edges may be cut.",
    ratio: 3 / 4,
    minWidth: 720,
    minHeight: 960,
  },
  howItWorksPoster: {
    kind: "image",
    shape: "Landscape 16:9, at least 1280 × 720 px.",
    crop: "Shown until the video loads. Phones crop it to 4:3 and wide screens to about 6:5, so keep the subject in the centre.",
    ratio: 16 / 9,
    minWidth: 1280,
    minHeight: 720,
  },
  howItWorksVideo: {
    kind: "video",
    shape: "Landscape 16:9 MP4 or WebM, at least 1280 × 720 px.",
    crop: "Plays muted on a loop. Phones crop it to 4:3 and wide screens to about 6:5, so keep on-screen text and faces in the centre.",
    ratio: 16 / 9,
    minWidth: 1280,
    minHeight: 720,
  },
};

/**
 * A soft warning for an upload that will look poor in its slot, or null when it fits. Never blocks
 * the upload: the admin may know better.
 */
export function mediaFitWarning(
  slot: MediaSlot,
  width: number,
  height: number,
): string | null {
  const guide = MEDIA_GUIDES[slot];
  if (!(width > 0 && height > 0)) return null;
  const size = `${width} × ${height} px`;
  if (width < guide.minWidth || height < guide.minHeight) {
    return `This file is ${size}, smaller than the ${guide.minWidth} × ${guide.minHeight} px we suggest. It may look soft on large screens.`;
  }
  // More than 25% off the slot's shape means a large part gets cropped away.
  const off = Math.abs(Math.log(width / height / guide.ratio));
  if (off > Math.log(1.25)) {
    return `This file is ${size}, a different shape from the slot. Check the preview: parts of it will be cropped.`;
  }
  return null;
}
