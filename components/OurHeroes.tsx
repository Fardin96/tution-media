import Image from "next/image";

const assets = {
  bgGradient: "/hero-assets/hero-bg.png",
  gradients: {
    left: "/hero-assets/gradient-left.svg",
    right: "/hero-assets/gradient-right.svg",
  },
  photos: [
    // Center four, left-to-right as in Figma hero frame 4021:384. Photo-Frame-0 is an
    // exact crop of photo-5 (the repeat recreates it); Photo-Frame-5 is a crop of a
    // photo we don't have in full, so photo-4 takes that edge.
    {
      id: "photo-2",
      fill: "#F3F0D1",
      src: "/assets/avatar-demo/Photo-Frame-1.png",
    },
    {
      id: "photo-3",
      fill: "#E1E9FE",
      src: "/assets/avatar-demo/Photo-Frame-2.png",
    },
    {
      id: "photo-4",
      fill: "#ECF5D6",
      src: "/assets/avatar-demo/Photo-Frame-3.png",
    },
    {
      id: "photo-5",
      fill: "#FFEDD2",
      src: "/assets/avatar-demo/Photo-Frame-4.png",
    },
  ],
  // Placeholder media for /profile and /admin (layout pass — no real images yet).
  // Fills reuse the Figma pastel set so placeholders sit inside the palette.
  avatars: [
    { id: "avatar-1", fill: "#FFEDD2", src: null as string | null },
    { id: "avatar-2", fill: "#E1E9FE", src: null as string | null },
    { id: "avatar-3", fill: "#ECF5D6", src: null as string | null },
    { id: "avatar-4", fill: "#F3F0D1", src: null as string | null },
  ],
  idCard: { id: "id-card", fill: "#E1E9FE", src: null as string | null },
  blogThumbs: [
    { id: "blog-1", fill: "#F3F0D1", src: null as string | null },
    { id: "blog-2", fill: "#ECF5D6", src: null as string | null },
    { id: "blog-3", fill: "#FFEDD2", src: null as string | null },
  ],
  videoPoster: {
    id: "how-to-video",
    fill: "#002B6B",
    src: null as string | null,
  },
};

// Repeats per side: 312px per card fills up to ~5000px wide screens.
const PHOTO_REPEATS = 7;
const n = assets.photos.length;
// Both sides step backwards through the set: left neighbor is photo-5 (as in the
// design), right is photo-4, and no two neighbors are the same photo.
const side = (start: number, tag: string) =>
  Array.from({ length: PHOTO_REPEATS }, (_, k) => ({
    photo: assets.photos[(((start - k) % n) + n) % n],
    key: `${tag}${k}`,
    repeat: true,
  }));
const photoRow = [
  ...side(n - 1, "l").reverse(),
  ...assets.photos.map((photo) => ({ photo, key: photo.id, repeat: false })),
  ...side(n - 2, "r"),
];

export default function OurHeroes() {
  return (
    //   < lg: swipeable row of the four photos; the next card peeks as the scroll cue.
    //   ≥ lg: the four centered, repeated outward on both sides and cropped by the
    //   viewport. At 1440 that is exactly the Figma frame (84px of a neighbor each side).

    <div className="-mx-6 mt-10 w-[calc(100%+3rem)] snap-x snap-mandatory scroll-px-6 [scrollbar-width:none] overflow-x-auto lg:mt-16 lg:snap-none lg:overflow-visible">
      <ul className="flex w-max gap-4 px-6 lg:w-full lg:justify-center lg:gap-[min(24px,1.6667%)] lg:px-0">
        {photoRow.map(({ photo, key, repeat }) => (
          <li
            key={key}
            className={`rounded-photo relative aspect-[288/338] w-[min(288px,calc(100vw-72px))] shrink-0 snap-start overflow-hidden lg:w-[min(288px,20%)] ${repeat ? "hidden lg:block" : ""}`}
            style={{ backgroundColor: photo.fill }}
          >
            <Image
              src={photo.src}
              alt=""
              fill
              sizes="(min-width: 1024px) min(288px, 20vw), min(288px, calc(100vw - 72px))"
              className="object-cover"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
