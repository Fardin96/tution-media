import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth/auth-split";

export const metadata: Metadata = { title: "Sign in · Masters Hub" };

export default function SignInPage() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID environment variable");
  }
  return <AuthSplit mode="sign-in" clientId={clientId} />;
}
