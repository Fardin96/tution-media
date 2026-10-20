export type UserRole = "STUDENT" | "TUTOR" | "ADMIN" | "SUPER_ADMIN";

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  picture?: string;
  status?: string;
}

export const SESSION_COOKIE = "session";
