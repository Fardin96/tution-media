import type { Metadata } from "next";
import { AuthSplit } from "@/components/auth/auth-split";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign up · Masters Hub" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID environment variable");
  }
  const params = await searchParams;
  const next = safeNext(params.next);
  // A visitor sent here from a tutor card is looking for a tutor, so Student starts picked.
  const defaultRole =
    params.role === "student"
      ? "STUDENT"
      : params.role === "tutor"
        ? "TUTOR"
        : undefined;
  return (
    <AuthSplit
      mode="sign-up"
      clientId={clientId}
      next={next ?? undefined}
      defaultRole={defaultRole}
    />
  );
}
