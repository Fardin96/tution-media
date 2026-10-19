import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth/auth-split";

export const metadata: Metadata = { title: "Sign up · Masters Hub" };

export default function SignUpPage() {
  return <AuthSplit mode="sign-up" />;
}
