import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export interface UserSession {
  email: string;
  name: string;
  picture?: string;
}

export const SESSION_COOKIE = "session";

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    return JSON.parse(value) as UserSession;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<UserSession> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

export function buildGoogleAuthUrl(): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const appUrl = process.env.NEXT_APP_URL;

  if (!clientId || !appUrl) {
    throw new Error("Missing Google OAuth environment variables");
  }

  const options = {
    redirect_uri: `${appUrl}/api/auth/callback/google`,
    client_id: clientId,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" "),
  };

  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(options).toString()}`;
}

export async function signOut() {
  "use server";
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/sign-in");
}
