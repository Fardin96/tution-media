import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth/auth-split";

export const metadata: Metadata = { title: "Sign in · Masters Hub" };

export default function SignInPage() {
  return <AuthSplit mode="sign-in" />;
}
