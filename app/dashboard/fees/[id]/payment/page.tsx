import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { PaymentResultPage } from "@/components/fees/payment-result-page";

export const metadata: Metadata = { title: "Payment · Masters Hub" };

export default async function FeePaymentRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "TUTOR") redirect("/dashboard");

  const { id } = await params;
  // useSearchParams in the client component needs a Suspense boundary; the tran id is read there.
  return (
    <Suspense fallback={null}>
      <PaymentResultPage feeId={id} />
    </Suspense>
  );
}
