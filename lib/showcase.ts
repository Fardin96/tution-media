type Base = {
  id: string;
  name: string;
  /** What they teach; shown where the design had a role. */
  subject: string;
  thumbnail: string;
};

export type VideoShowcase = Base & {
  kind: "video";
  /** Drop a file in public/ and set this; until then the card toggles play/pause state only. */
  video?: string;
};

export type CommentShowcase = Base & {
  kind: "comment";
  university: string;
  comment: string;
};

export type ShowcaseItem = VideoShowcase | CommentShowcase;

const thumb = (n: number) => `/assets/avatar-demo/tutor/tutor${n}.png`;

// ponytail: placeholder data; 4 thumbnails reused. Every third item is a comment card.
const raw: (
  | Omit<VideoShowcase, "id" | "thumbnail">
  | Omit<CommentShowcase, "id" | "thumbnail">
)[] = [
  { kind: "video", name: "Tanvir Ahmed", subject: "Higher Math" },
  { kind: "video", name: "Sadia Islam", subject: "English Language" },
  {
    kind: "comment",
    name: "Rafiul Karim",
    subject: "Physics",
    university: "BUET, Electrical Engineering",
    comment:
      "I teach physics the way I wish I had learned it: start from a real example, then the formula. Most of my students stop memorising within a month.",
  },
  { kind: "video", name: "Nabila Hossain", subject: "Chemistry" },
  { kind: "video", name: "Imran Chowdhury", subject: "Accounting" },
  {
    kind: "comment",
    name: "Farzana Akter",
    subject: "Biology",
    university: "Dhaka Medical College, MBBS",
    comment:
      "Diagrams, short recalls and weekly mock tests. My SSC and HSC students walk into exams knowing exactly what to expect.",
  },
  { kind: "video", name: "Mehedi Hasan", subject: "ICT & Programming" },
  { kind: "video", name: "Ayesha Rahman", subject: "Bangla Literature" },
  {
    kind: "comment",
    name: "Shakil Mahmud",
    subject: "Finance",
    university: "IBA, University of Dhaka",
    comment:
      "I connect every finance topic to money decisions students already make. Once it feels practical, the numbers get easy.",
  },
  { kind: "video", name: "Tasnim Jahan", subject: "O Level Mathematics" },
  { kind: "video", name: "Arif Hossain", subject: "Economics" },
  {
    kind: "comment",
    name: "Lamia Sultana",
    subject: "Art & Drawing",
    university: "Faculty of Fine Arts, University of Dhaka",
    comment:
      "Every class ends with a finished piece, however small. Confidence comes from seeing your own progress on paper.",
  },
];

export const showcase: ShowcaseItem[] = raw.map((item, i) => {
  let videoIndex = 0;
  if (item.kind === "video") {
    // Calculate a stable, 1-based index for video items up to this point.
    videoIndex = raw.slice(0, i + 1).filter((r) => r.kind === "video").length;
  }
  return {
    ...item,
    id: `showcase-${i + 1}`,
    thumbnail: thumb((i % 4) + 1),
    ...(item.kind === "video" && {
      video: `/videos/tutor${videoIndex}.mp4`,
    }),
  } as ShowcaseItem;
});
