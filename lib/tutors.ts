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
  location: string;
  institute: string;
  rating: number;
  reviews: number;
  categories: CategoryId[];
};

let n = 0;
const tutor = (
  name: string,
  position: string,
  location: string,
  institute: string,
  rating: number,
  reviews: number,
  categories: CategoryId[],
): Tutor => ({
  id: `tutor-${++n}`,
  name,
  avatar: `/assets/avatar-demo/${name.replace(" ", "-")}.png`,
  position,
  location,
  institute,
  rating,
  reviews,
  categories,
});

// ponytail: placeholder data, names/photos reused; swap for the API when it exists.
// Every category has at least 8 tutors, enough to fill the landing preview.
export const tutors: Tutor[] = [
  tutor("Zrand Hobs", "Math Tutor", "Dhanmondi, Dhaka", "BUET", 4.8, 6, [
    "math",
    "physics",
  ]),
  tutor(
    "Dorothy Wood",
    "English Teacher",
    "Gulshan, Dhaka",
    "University of Dhaka",
    4.9,
    12,
    ["english", "art"],
  ),
  tutor(
    "Timothy Baker",
    "Accounting Tutor",
    "Uttara, Dhaka",
    "North South University",
    4.7,
    9,
    ["accounting", "finance", "math"],
  ),
  tutor("Shane Pratt", "Physics Teacher", "Mirpur, Dhaka", "BUET", 4.8, 15, [
    "physics",
    "math",
    "packages",
  ]),
  tutor(
    "Frances Washing",
    "Art Instructor",
    "Banani, Dhaka",
    "University of Dhaka",
    4.6,
    7,
    ["art", "english"],
  ),
  tutor(
    "Jason Bell",
    "Finance Tutor",
    "Bashundhara, Dhaka",
    "IBA, University of Dhaka",
    4.8,
    10,
    ["finance", "accounting"],
  ),
  tutor(
    "Kathryn Sanchez",
    "English Tutor",
    "Mohammadpur, Dhaka",
    "BRAC University",
    5.0,
    4,
    ["english", "packages"],
  ),
  tutor(
    "Jaime Strickland",
    "Math Teacher",
    "Motijheel, Dhaka",
    "Dhaka College",
    4.9,
    21,
    ["math", "finance", "packages"],
  ),
  tutor("Dorothy Wood", "Physics Tutor", "Badda, Dhaka", "IUT", 4.7, 8, [
    "physics",
    "packages",
  ]),
  tutor(
    "Shane Pratt",
    "Accounting Teacher",
    "Farmgate, Dhaka",
    "Jagannath University",
    4.5,
    5,
    ["accounting", "math"],
  ),
  tutor(
    "Kathryn Sanchez",
    "Art Tutor",
    "Lalmatia, Dhaka",
    "Shanto-Mariam University",
    4.8,
    11,
    ["art", "packages"],
  ),
  tutor(
    "Timothy Baker",
    "Finance Teacher",
    "Khilgaon, Dhaka",
    "East West University",
    4.6,
    6,
    ["finance", "english"],
  ),
  tutor(
    "Jason Bell",
    "Physics Tutor",
    "Shyamoli, Dhaka",
    "University of Dhaka",
    4.7,
    9,
    ["physics", "math"],
  ),
  tutor(
    "Frances Washing",
    "Art Teacher",
    "Gulshan, Dhaka",
    "BRAC University",
    4.9,
    14,
    ["art", "packages"],
  ),
  tutor(
    "Jaime Strickland",
    "Accounting Tutor",
    "Banani, Dhaka",
    "IBA, University of Dhaka",
    4.8,
    13,
    ["accounting", "finance"],
  ),
  tutor(
    "Zrand Hobs",
    "English Tutor",
    "Dhanmondi, Dhaka",
    "North South University",
    4.6,
    5,
    ["english", "art"],
  ),
  tutor("Dorothy Wood", "Finance Tutor", "Uttara, Dhaka", "AIUB", 4.7, 10, [
    "finance",
    "accounting",
    "math",
  ]),
  tutor(
    "Timothy Baker",
    "Physics Teacher",
    "Mirpur, Dhaka",
    "Dhaka College",
    4.8,
    17,
    ["physics", "english"],
  ),
  tutor(
    "Kathryn Sanchez",
    "Accounting Teacher",
    "Bashundhara, Dhaka",
    "Independent University",
    4.5,
    3,
    ["accounting", "packages"],
  ),
  tutor("Shane Pratt", "Art Tutor", "Mohammadpur, Dhaka", "BUET", 4.9, 8, [
    "art",
    "physics",
  ]),
  tutor(
    "Jason Bell",
    "English Teacher",
    "Tejgaon, Dhaka",
    "University of Dhaka",
    4.8,
    19,
    ["english", "finance", "packages"],
  ),
  tutor(
    "Frances Washing",
    "Math Tutor",
    "Rampura, Dhaka",
    "East West University",
    4.7,
    7,
    ["math", "physics", "art"],
  ),
  tutor(
    "Jaime Strickland",
    "Physics Teacher",
    "Wari, Dhaka",
    "Jagannath University",
    4.6,
    12,
    ["physics", "english"],
  ),
  tutor(
    "Zrand Hobs",
    "Finance Tutor",
    "Motijheel, Dhaka",
    "IBA, University of Dhaka",
    5.0,
    6,
    ["finance", "accounting", "art"],
  ),
  tutor(
    "Dorothy Wood",
    "Accounting Tutor",
    "Malibagh, Dhaka",
    "Dhaka Commerce College",
    4.7,
    9,
    ["accounting"],
  ),
];
