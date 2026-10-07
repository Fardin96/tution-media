export const categories = [
  { id: "math", label: "Math", icon: "ic-math" },
  { id: "physics", label: "Physics", icon: "ic-physics" },
  { id: "english", label: "English", icon: "ic-english" },
  { id: "accounting", label: "Accounting", icon: "ic-accounting" },
  { id: "finance", label: "Finance", icon: "ic-finance" },
  { id: "art", label: "Art", icon: "ic-art" },
  { id: "packages", label: "Packages", icon: "ic-packages" },
] as const;

export type CategoryId = (typeof categories)[number]["id"];

export const categoryLabel = Object.fromEntries(
  categories.map((c) => [c.id, c.label]),
) as Record<CategoryId, string>;

export type Tutor = {
  id: string;
  name: string;
  avatar: string;
  position: string;
  rating: number;
  reviews: number;
  categories: CategoryId[];
};

let n = 0;
const tutor = (
  name: string,
  position: string,
  rating: number,
  reviews: number,
  categories: CategoryId[],
): Tutor => ({
  id: `tutor-${++n}`,
  name,
  avatar: `/assets/avatar-demo/${name.replace(" ", "-")}.png`,
  position,
  rating,
  reviews,
  categories,
});

// ponytail: placeholder data, names/photos reused; swap for the API when it exists.
// Every category has at least 3 tutors.
export const tutors: Tutor[] = [
  tutor("Zrand Hobs", "Math Tutor", 4.8, 6, ["math", "physics"]),
  tutor("Dorothy Wood", "English Teacher", 4.9, 12, ["english", "art"]),
  tutor("Timothy Baker", "Accounting Tutor", 4.7, 9, [
    "accounting",
    "finance",
    "math",
  ]),
  tutor("Shane Pratt", "Physics Teacher", 4.8, 15, [
    "physics",
    "math",
    "packages",
  ]),
  tutor("Frances Washing", "Art Instructor", 4.6, 7, ["art", "english"]),
  tutor("Jason Bell", "Finance Tutor", 4.8, 10, ["finance", "accounting"]),
  tutor("Kathryn Sanchez", "English Tutor", 5.0, 4, ["english", "packages"]),
  tutor("Jaime Strickland", "Math Teacher", 4.9, 21, [
    "math",
    "finance",
    "packages",
  ]),
  tutor("Dorothy Wood", "Physics Tutor", 4.7, 8, ["physics", "packages"]),
  tutor("Shane Pratt", "Accounting Teacher", 4.5, 5, ["accounting", "math"]),
  tutor("Kathryn Sanchez", "Art Tutor", 4.8, 11, ["art", "packages"]),
  tutor("Timothy Baker", "Finance Teacher", 4.6, 6, ["finance", "english"]),
];
