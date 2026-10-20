import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth/auth-split";

export const metadata: Metadata = { title: "Sign up · Masters Hub" };

export default function SignUpPage() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID environment variable");
  }
  return <AuthSplit mode="sign-up" clientId={clientId} />;
}
