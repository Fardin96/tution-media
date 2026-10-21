import { api } from "./api";

export type ProfileRole = "STUDENT" | "TUTOR";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type VerificationStatus =
  "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";

interface BaseProfile {
  id: string;
  name: string;
  address: string;
  emergencyContact: string;
  whatsappNumber: string;
  whatsappVerifiedAt: string | null;
  studentIdNumber: string;
  verificationStatus: VerificationStatus;
  // Prisma Decimal arrives as a string from GET /me.
  ratingAvg: number | string;
  ratingCount: number;
  createdAt: string;
}

export interface StudentProfile extends BaseProfile {
  areaId: number;
}

export interface TutorProfile extends BaseProfile {
  gender: Gender;
  parentsInfo: string | null;
  isListed: boolean;
}

export interface Me {
  id: string;
  role: ProfileRole | "ADMIN";
  email: string;
  status: string;
  createdAt: string;
  student: StudentProfile | null;
  tutor: TutorProfile | null;
}

export interface Option {
  id: number;
  name: string;
}

/* ───────── Lookups ───────── */

// shortcut: placeholder Dhaka areas with made-up ids. Replace with Google Places
// suggestions (mapped to backend area ids) when that integration lands.
export const AREAS: Option[] = [
  "Dhanmondi",
  "Gulshan",
  "Banani",
  "Uttara",
  "Mirpur",
  "Mohammadpur",
  "Bashundhara",
  "Badda",
  "Rampura",
  "Khilgaon",
  "Motijheel",
  "Old Dhaka",
  "Lalmatia",
  "Tejgaon",
  "Farmgate",
  "Shyamoli",
  "Malibagh",
  "Moghbazar",
  "Wari",
  "Jatrabari",
].map((name, i) => ({ id: i + 1, name }));

// shortcut: static list until GET /api/v1/subjects exists; ids must match the seeded table.
export const SUBJECTS: Option[] = [
  "Bangla",
  "English",
  "Mathematics",
  "Higher Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "ICT",
  "Accounting",
  "Finance",
  "Economics",
  "General Science",
  "Religion",
  "Arabic",
].map((name, i) => ({ id: i + 1, name }));

/** Async so a Places-backed lookup can drop in without touching the picker. */
export async function searchAreas(query: string): Promise<Option[]> {
  const q = query.trim().toLowerCase();
  return q ? AREAS.filter((a) => a.name.toLowerCase().includes(q)) : AREAS;
}

export const optionName = (list: Option[], id: number) =>
  list.find((o) => o.id === id)?.name ?? `#${id}`;

/* ───────── Phone numbers ───────── */

/** Accepts 01XXXXXXXXX, 8801…, +8801… with spaces or dashes. Returns E.164 or null. */
export function normalizeBdPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  const m = digits.match(/^(?:\+?880|0)?(1[3-9]\d{8})$/);
  return m ? `+880${m[1]}` : null;
}

export function formatBdPhone(e164: string): string {
  const m = e164.match(/^\+880(\d{4})(\d{6})$/);
  return m ? `+880 ${m[1]}-${m[2]}` : e164;
}

/* ───────── Form model ───────── */

export interface ProfileForm {
  name: string;
  studentIdNumber: string;
  gender: Gender | "";
  whatsappNumber: string;
  emergencyContact: string;
  address: string;
  parentsInfo: string;
  /** Student: exactly one area. Tutor: areas they teach in. */
  areaIds: number[];
  subjectIds: number[];
}

export type FieldKey = keyof ProfileForm;
export type FieldKind =
  "text" | "tel" | "textarea" | "gender" | "area" | "areas" | "subjects";

export interface FieldDef {
  key: FieldKey;
  kind: FieldKind;
  label: string;
  hint?: string;
  placeholder?: string;
  optional?: boolean;
  autoComplete?: string;
  maxLength?: number;
}

export interface Section {
  id: string;
  title: string;
  description: string;
  fields: FieldDef[];
}

const name: FieldDef = {
  key: "name",
  kind: "text",
  label: "Full name",
  autoComplete: "name",
  placeholder: "Rahim Uddin",
  maxLength: 200,
};
const whatsapp: FieldDef = {
  key: "whatsappNumber",
  kind: "tel",
  label: "WhatsApp number",
  hint: "We send tuition updates here.",
  placeholder: "01XXXXXXXXX",
  autoComplete: "tel",
};
const emergency: FieldDef = {
  key: "emergencyContact",
  kind: "tel",
  label: "Emergency contact number",
  hint: "Someone we can call if we can't reach you.",
  placeholder: "01XXXXXXXXX",
};
const address: FieldDef = {
  key: "address",
  kind: "textarea",
  label: "Address",
  placeholder: "House 12, Road 4",
  autoComplete: "street-address",
  maxLength: 500,
};

export const SECTIONS: Record<ProfileRole, Section[]> = {
  STUDENT: [
    {
      id: "identity",
      title: "About you",
      description: "Tutors see your name when you post a requirement.",
      fields: [
        name,
        {
          key: "studentIdNumber",
          kind: "text",
          label: "Student ID number",
          hint: "From your school, college or university ID card.",
          placeholder: "NDC-2024-1187",
          maxLength: 100,
        },
      ],
    },
    {
      id: "contact",
      title: "Contact",
      description: "Only shared with a tutor once you confirm them.",
      fields: [whatsapp, emergency],
    },
    {
      id: "location",
      title: "Location",
      description: "Where tuition will take place.",
      fields: [
        { key: "areaIds", kind: "area", label: "Area" },
        { ...address, hint: "Your detailed address stays private." },
      ],
    },
  ],
  TUTOR: [
    {
      id: "identity",
      title: "About you",
      description: "Students see your name on your public profile.",
      fields: [
        name,
        { key: "gender", kind: "gender", label: "Gender" },
        {
          key: "studentIdNumber",
          kind: "text",
          label: "University student ID",
          hint: "Used to verify you. It's never shown publicly.",
          placeholder: "1805123",
          maxLength: 100,
        },
      ],
    },
    {
      id: "contact",
      title: "Contact",
      description: "Only shared with a student once you're confirmed.",
      fields: [
        whatsapp,
        emergency,
        { ...address, hint: "Kept private. Used for verification." },
        {
          key: "parentsInfo",
          kind: "textarea",
          label: "Parent or guardian details",
          hint: "Name and phone number.",
          placeholder: "Abdul Karim (father), 01XXXXXXXXX",
          optional: true,
          maxLength: 1000,
        },
      ],
    },
    {
      id: "teaching",
      title: "Teaching",
      description: "Students find you by subject and area.",
      fields: [
        { key: "subjectIds", kind: "subjects", label: "Subjects you teach" },
        { key: "areaIds", kind: "areas", label: "Areas you can travel to" },
      ],
    },
  ],
};

export const emptyForm = (fullName = ""): ProfileForm => ({
  name: fullName,
  studentIdNumber: "",
  gender: "",
  whatsappNumber: "",
  emergencyContact: "",
  address: "",
  parentsInfo: "",
  areaIds: [],
  subjectIds: [],
});

export function formFromProfile(
  profile: StudentProfile | TutorProfile,
  extras: { areaIds?: number[]; subjectIds?: number[] } = {},
): ProfileForm {
  return {
    name: profile.name,
    studentIdNumber: profile.studentIdNumber,
    gender: "gender" in profile ? profile.gender : "",
    whatsappNumber: profile.whatsappNumber,
    emergencyContact: profile.emergencyContact,
    address: profile.address,
    parentsInfo: "parentsInfo" in profile ? (profile.parentsInfo ?? "") : "",
    areaIds: "areaId" in profile ? [profile.areaId] : (extras.areaIds ?? []),
    subjectIds: extras.subjectIds ?? [],
  };
}

export type FormErrors = Partial<Record<FieldKey, string>>;

// "Student ID number" -> "student ID number", but "WhatsApp number" stays as is.
const lowerFirst = (s: string) =>
  /^[A-Z][a-z]+\b/.test(s) && !/^[A-Z][a-z]*[A-Z]/.test(s)
    ? s[0].toLowerCase() + s.slice(1)
    : s;

export function validate(fields: FieldDef[], form: ProfileForm): FormErrors {
  const errors: FormErrors = {};
  for (const f of fields) {
    const value = form[f.key];
    if (Array.isArray(value)) {
      if (value.length === 0)
        errors[f.key] =
          f.kind === "area" ? "Choose your area." : "Choose at least one.";
      continue;
    }
    const text = value.trim();
    if (!text) {
      if (!f.optional)
        errors[f.key] =
          f.kind === "gender"
            ? "Choose an option."
            : `Enter your ${lowerFirst(f.label)}.`;
      continue;
    }
    if (f.kind === "tel" && !normalizeBdPhone(text))
      errors[f.key] = "Enter an 11-digit Bangladeshi number, like 01712345678.";
    else if (f.maxLength && text.length > f.maxLength)
      errors[f.key] = `Keep it under ${f.maxLength} characters.`;
  }
  if (
    fields.some((f) => f.key === "emergencyContact") &&
    !errors.emergencyContact &&
    normalizeBdPhone(form.emergencyContact) ===
      normalizeBdPhone(form.whatsappNumber)
  )
    errors.emergencyContact = "Use a different number from your WhatsApp.";
  return errors;
}

/** Body for POST/PATCH /students|tutors/me, limited to `keys`. Lists are saved separately for tutors. */
export function toPayload(
  role: ProfileRole,
  form: ProfileForm,
  keys: FieldKey[],
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of keys) {
    if (key === "subjectIds") continue;
    if (key === "areaIds") {
      if (role === "STUDENT") body.areaId = form.areaIds[0];
      continue;
    }
    const text = form[key].trim();
    if (key === "whatsappNumber" || key === "emergencyContact")
      body[key] = normalizeBdPhone(text);
    else if (key === "parentsInfo") body[key] = text || undefined;
    else body[key] = text;
  }
  return body;
}

/* ───────── API ───────── */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function json<T>(res: Response): Promise<T> {
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  const message =
    res.status === 401
      ? "Your session has expired. Sign in again."
      : res.status >= 500
        ? "Something went wrong on our side. If you changed a phone number, it may already be in use. Try again in a moment."
        : body.message || `Request failed (${res.status}).`;
  throw new ApiError(message, res.status);
}

const profilePath = (role: ProfileRole) =>
  role === "STUDENT" ? "/api/v1/students/me" : "/api/v1/tutors/me";

export interface TutorExtras {
  areas: Option[];
  subjects: Option[];
}

export interface Credential {
  id: string;
  examLabel: string;
  result: string;
  file: { id: string; status: string };
}

export interface Video {
  id: string;
  title: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface Verification {
  id: string;
  status: VerificationStatus;
  submittedAt: string;
  decidedAt: string | null;
  note: string | null;
}

export const profileApi = {
  me: async () =>
    (await json<{ account: Me }>(await api.get("/api/v1/me"))).account,

  /** Creates the profile, or updates it if a previous attempt already created it. */
  save: async (role: ProfileRole, body: Record<string, unknown>) => {
    const res = await api.post(profilePath(role), body);
    if (res.status === 409)
      return json<StudentProfile | TutorProfile>(
        await api.patch(profilePath(role), body),
      );
    return json<StudentProfile | TutorProfile>(res);
  },

  update: async (role: ProfileRole, body: Record<string, unknown>) =>
    json<StudentProfile | TutorProfile>(
      await api.patch(profilePath(role), body),
    ),

  setTutorAreas: async (areaIds: number[]) =>
    json(await api.put("/api/v1/tutors/me/areas", { areaIds })),

  setTutorSubjects: async (subjectIds: number[]) =>
    json(await api.put("/api/v1/tutors/me/subjects", { subjectIds })),

  /** Areas and subjects aren't on GET /me; the public profile has them. */
  tutorExtras: async (tutorId: string) =>
    (
      await json<{ tutor: TutorExtras }>(
        await api.get(`/api/v1/tutors/${tutorId}`),
      )
    ).tutor,

  credentials: async () =>
    (
      await json<{ credentials: Credential[] }>(
        await api.get("/api/v1/tutors/me/credentials"),
      )
    ).credentials,

  deleteCredential: async (id: string) =>
    json(await api.delete(`/api/v1/tutors/me/credentials/${id}`)),

  videos: async () =>
    (await json<{ videos: Video[] }>(await api.get("/api/v1/tutors/me/videos")))
      .videos,

  deleteVideo: async (id: string) =>
    json(await api.delete(`/api/v1/tutors/me/videos/${id}`)),

  verifications: async () =>
    (
      await json<{ verifications: Verification[] }>(
        await api.get("/api/v1/tutors/me/verifications"),
      )
    ).verifications,
};

/** Saves the tutor's subject and area sets. Both are full replacements. */
export async function saveTutorLists(form: ProfileForm, keys: FieldKey[]) {
  await Promise.all([
    keys.includes("subjectIds") && profileApi.setTutorSubjects(form.subjectIds),
    keys.includes("areaIds") && profileApi.setTutorAreas(form.areaIds),
  ]);
}

export const profileOf = (me: Me) => me.student ?? me.tutor;

/** Drops tokens and the session cookie, e.g. when the API says the session is gone. */
export async function clearSession() {
  api.clearTokens();
  await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
}
