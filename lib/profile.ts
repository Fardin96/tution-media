import { api } from "./api";
import { client, unwrap, type Schemas } from "./api-client";
import { loadAreas } from "./areas";
import { loadSubjects } from "./subjects";

export type ProfileRole = "STUDENT" | "TUTOR";
export type Gender = NonNullable<Schemas["CreateTutorProfileInput"]["gender"]>;
export type VerificationStatus = Schemas["MeStudent"]["verificationStatus"];

/**
 * Me responses send ratingAvg as a Decimal string; profile responses send a number. Profile
 * updates are merged into the Me record, and formFromProfile takes Me records too, so the
 * field accepts both.
 */
export type WithRating<T> = Omit<T, "ratingAvg"> & {
  ratingAvg: number | string;
};

export type StudentProfile = WithRating<Schemas["StudentProfile"]>;
export type TutorProfile = WithRating<Schemas["Tutor"]>;
export type MeStudent = WithRating<Schemas["MeStudent"]>;
export type MeTutor = WithRating<Schemas["MeTutor"]>;
export type Me = Omit<Schemas["MeAccount"], "student" | "tutor"> & {
  student?: MeStudent;
  tutor?: MeTutor;
};

/** Fields a profile create or update may send. The server decides which are required. */
export type ProfileBody = Partial<
  Schemas["UpdateStudentProfileInput"] & Schemas["UpdateTutorProfileInput"]
>;

export interface Option {
  id: number;
  name: string;
}

/* ───────── Lookups ───────── */

export const TUITION_TYPES = [
  "Home Tutoring Solo",
  "Home Tutoring Group",
  "Online",
  "Group Coaching",
] as const;

/** Async so a Places/backend-backed lookup can drop in without touching the picker. */
export async function searchAreas(query: string): Promise<Option[]> {
  const areas = await loadAreas();
  const q = query.trim().toLowerCase();
  return q ? areas.filter((a) => a.name.toLowerCase().includes(q)) : areas;
}

export async function searchSubjects(query: string): Promise<Option[]> {
  const subjects = await loadSubjects();
  const q = query.trim().toLowerCase();
  return q
    ? subjects.filter((s) => s.name.toLowerCase().includes(q))
    : subjects;
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
  /** Tutor only: the university or college they study at. */
  instituteName: string;
  gender: Gender | "";
  phoneNumber: string;
  whatsappNumber: string;
  emergencyContact: string;
  address: string;
  placeId: string;
  latitude: number | null;
  longitude: number | null;
  district: string | null;
  parentsInfo: string;
  /** Student: exactly one area. Tutor: areas they teach in. */
  areaIds: number[];
  subjectIds: number[];
}

export type FieldKey = keyof ProfileForm;
export type FieldKind =
  | "text"
  | "tel"
  | "textarea"
  | "address"
  | "gender"
  | "area"
  | "areas"
  | "subjects";

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
const phone: FieldDef = {
  key: "phoneNumber",
  kind: "tel",
  label: "Phone number",
  hint: "We'll use this to contact you.",
  placeholder: "01XXXXXXXXX",
  autoComplete: "tel",
};
const whatsapp: FieldDef = {
  key: "whatsappNumber",
  kind: "tel",
  label: "WhatsApp number",
  hint: "Add it if different from your phone number.",
  placeholder: "01XXXXXXXXX",
  autoComplete: "tel",
  optional: true,
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
  kind: "address",
  label: "Address",
  placeholder: "Start typing your address",
  autoComplete: "street-address",
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
      fields: [phone, whatsapp, emergency],
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
          key: "instituteName",
          kind: "text",
          label: "University or college",
          hint: "Students see this on your profile.",
          placeholder: "University of Dhaka",
          maxLength: 120,
          autoComplete: "organization",
        },
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
        phone,
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
  instituteName: "",
  gender: "",
  phoneNumber: "",
  whatsappNumber: "",
  emergencyContact: "",
  address: "",
  placeId: "",
  latitude: null,
  longitude: null,
  district: null,
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
    studentIdNumber: profile.studentIdNumber ?? "",
    instituteName:
      "instituteName" in profile ? (profile.instituteName ?? "") : "",
    gender: "gender" in profile ? profile.gender : "",
    phoneNumber: profile.phoneNumber,
    whatsappNumber: profile.whatsappNumber ?? "",
    emergencyContact: profile.emergencyContact ?? "",
    address: profile.address,
    placeId: profile.location?.placeId ?? "",
    latitude: profile.location?.lat ?? null,
    longitude: profile.location?.lng ?? null,
    district: profile.location?.districtCode || null,
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
    if (typeof value !== "string") continue;
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
  const phoneE164 = normalizeBdPhone(form.phoneNumber);
  // const whatsappE164 = normalizeBdPhone(form.whatsappNumber);
  // if (
  //   fields.some((f) => f.key === "whatsappNumber") &&
  //   !errors.whatsappNumber &&
  //   whatsappE164 &&
  //   whatsappE164 === phoneE164
  // )
  //   errors.whatsappNumber =
  //     "WhatsApp is the same as your phone number. Leave it empty if they match.";
  const emergencyE164 = normalizeBdPhone(form.emergencyContact);
  if (
    fields.some((f) => f.key === "emergencyContact") &&
    !errors.emergencyContact
  ) {
    if (emergencyE164 && emergencyE164 === phoneE164)
      errors.emergencyContact =
        "Use a different number from your phone number.";
    // else if (emergencyE164 && emergencyE164 === whatsappE164)
    //   errors.emergencyContact = "Use a different number from your WhatsApp.";
  }
  return errors;
}

/** Body for POST/PATCH /students|tutors/me, limited to `keys`. Lists are saved separately for tutors. */
export function toPayload(
  role: ProfileRole,
  form: ProfileForm,
  keys: FieldKey[],
): ProfileBody {
  // Built key by key, so the dynamic writes stay loose and the result is cast once below.
  const body: Record<string, unknown> = {};
  for (const key of keys) {
    if (key === "subjectIds") continue;
    if (key === "instituteName") {
      // Tutor-only; the student sections never list it, so students never send it.
      if (role === "TUTOR") body.instituteName = form.instituteName.trim();
      continue;
    }
    if (key === "areaIds") {
      if (role === "STUDENT") body.areaId = form.areaIds[0];
      continue;
    }
    if (key === "address") {
      const address = form.address.trim();
      body.address = address;
      const district = form.district?.trim();
      if (
        form.placeId &&
        district &&
        form.latitude != null &&
        form.longitude != null
      )
        body.location = {
          lat: form.latitude,
          lng: form.longitude,
          addressText: address,
          district,
          placeId: form.placeId,
        };
      continue;
    }
    const value = form[key];
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (
      key === "phoneNumber" ||
      key === "whatsappNumber" ||
      key === "emergencyContact"
    )
      body[key] = normalizeBdPhone(text);
    else if (key === "parentsInfo") body[key] = text || undefined;
    else body[key] = text;
  }
  return body as ProfileBody;
}

/* ───────── API ───────── */

/** One zod issue from a 400 VALIDATION_ERROR; array indexes in `path` are numbers. */
export interface ApiIssue {
  path: (string | number)[];
  message: string;
}

export class ApiError extends Error {
  readonly code?: string;
  readonly details?: Record<string, unknown>;
  readonly issues?: ApiIssue[];

  constructor(
    message: string,
    readonly status: number,
    extra: {
      code?: string;
      details?: Record<string, unknown>;
      issues?: ApiIssue[];
    } = {},
  ) {
    super(message);
    this.code = extra.code;
    this.details = extra.details;
    this.issues = extra.issues;
  }
}

/** The form field a duplicate-number 409 belongs to, so its message can sit next to that field. */
export function conflictField(err: unknown): FieldKey | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  if (/phone number/i.test(err.message)) return "phoneNumber";
  if (/whatsapp number/i.test(err.message)) return "whatsappNumber";
  return null;
}

export async function parseJson<T>(res: Response): Promise<T> {
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  throw toApiError(res.status, await res.json().catch(() => ({})));
}

export interface ApiErrorBody {
  error?: string;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
  issues?: ApiIssue[];
}

/** Builds the ApiError for a failed response from its status and parsed body. */
export function toApiError(status: number, raw: unknown): ApiError {
  const body = (raw && typeof raw === "object" ? raw : {}) as ApiErrorBody;
  const message =
    status === 401
      ? "Your session has expired. Sign in again."
      : status >= 500
        ? "Something went wrong on our side. If you changed a phone number, it may already be in use. Try again in a moment."
        : body.error === "PhoneInUse"
          ? "Phone number is already in use, please use a different one."
          : body.error === "WhatsappInUse"
            ? "WhatsApp number is already in use, please use a different one."
            : body.message || `Request failed (${status}).`;
  return new ApiError(message, status, {
    code: body.code,
    details: body.details,
    issues: body.issues,
  });
}

export type TutorExtras = Pick<
  Schemas["TutorPublicProfile"],
  "areas" | "subjects"
>;
export type Credential = Schemas["TutorCredential"];
export type Video = Schemas["TutorVideo"];
export type Verification = Schemas["TutorVerification"];

type ProfileResponse = StudentProfile | TutorProfile;

// The client needs literal paths, so each role gets its own call. ProfileBody is a partial
// union of the update inputs, so the create bodies (which require fields) are cast here.
const postProfile = (role: ProfileRole, body: ProfileBody) =>
  role === "STUDENT"
    ? client.POST("/api/v1/students/me", {
        body: body as Schemas["CreateStudentProfileInput"],
      })
    : client.POST("/api/v1/tutors/me", {
        body: body as Schemas["CreateTutorProfileInput"],
      });

const patchProfile = (role: ProfileRole, body: ProfileBody) =>
  role === "STUDENT"
    ? client.PATCH("/api/v1/students/me", {
        body: body as Schemas["UpdateStudentProfileInput"],
      })
    : client.PATCH("/api/v1/tutors/me", {
        body: body as Schemas["UpdateTutorProfileInput"],
      });

export const profileApi = {
  me: async (): Promise<Me> => (await unwrap(client.GET("/api/v1/me"))).account,

  /** Creates the profile, or updates it if a previous attempt already created it. */
  save: async (
    role: ProfileRole,
    body: ProfileBody,
  ): Promise<ProfileResponse> => {
    const result = await postProfile(role, body);
    const { message = "" } = (result.error ?? {}) as { message?: string };
    if (
      result.response.status === 409 &&
      /profile already exists/i.test(message)
    )
      return unwrap<ProfileResponse>(patchProfile(role, body));
    return unwrap<ProfileResponse>(Promise.resolve(result));
  },

  update: async (role: ProfileRole, body: ProfileBody) =>
    unwrap<ProfileResponse>(patchProfile(role, body)),

  setTutorAreas: async (areaIds: number[]) =>
    unwrap(client.PUT("/api/v1/tutors/me/areas", { body: { areaIds } })),

  setTutorSubjects: async (subjectIds: number[]) =>
    unwrap(client.PUT("/api/v1/tutors/me/subjects", { body: { subjectIds } })),

  /** Areas and subjects aren't on GET /me; the public profile has them. */
  tutorExtras: async (tutorId: string): Promise<TutorExtras> =>
    (
      await unwrap(
        client.GET("/api/v1/tutors/{id}", {
          params: { path: { id: tutorId } },
        }),
      )
    ).tutor,

  credentials: async () =>
    (await unwrap(client.GET("/api/v1/tutors/me/credentials"))).credentials,

  deleteCredential: async (id: string) =>
    unwrap(
      client.DELETE("/api/v1/tutors/me/credentials/{id}", {
        params: { path: { id } },
      }),
    ),

  videos: async () =>
    (await unwrap(client.GET("/api/v1/tutors/me/videos"))).videos,

  deleteVideo: async (id: string) =>
    unwrap(
      client.DELETE("/api/v1/tutors/me/videos/{id}", {
        params: { path: { id } },
      }),
    ),

  verifications: async () =>
    (await unwrap(client.GET("/api/v1/tutors/me/verifications"))).verifications,

  deleteMe: async () => unwrap(client.DELETE("/api/v1/me")),

  hardDeleteMe: async () => {
    const tokens = api.getTokens();
    const res = await fetch("/api/v1/me/hard-delete", {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        Authorization: tokens?.accessToken
          ? `Bearer ${tokens.accessToken}`
          : "",
      },
    });
    return parseJson(await res);
  },
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
