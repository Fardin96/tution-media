import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth/auth-split";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in · Masters Hub" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID environment variable");
  }
  const next = safeNext((await searchParams).next);
  return (
    <AuthSplit mode="sign-in" clientId={clientId} next={next ?? undefined} />
  );
}
