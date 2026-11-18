import { FEE_STATUS_META, PAYMENT_METHOD_LABEL } from "@/lib/admin-fees";
import type { TutorFee, TutorFeePayment } from "@/lib/fees";
import type { Tone } from "@/lib/requirements";

const MONEY = new Intl.NumberFormat("en-BD", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "৳1,537.50". Money arrives as decimal strings and always shows two decimals. */
export function formatMoney(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `৳${MONEY.format(amount)}` : value;
}

/** "2.50" becomes "2.5", "2.00" becomes "2". */
export function formatPercent(value: string): string {
  const percent = Number(value);
  return Number.isFinite(percent) ? String(percent) : value;
}

/**
 * The status pill for a fee. Unpaid and Overdue replace the plain status, the same way the
 * tutor's own copy does; the other statuses keep the admin labels. A partly paid fee past its
 * due date is still late, so Overdue covers DUE and PARTIAL.
 */
export function feeStatusDisplay(
  fee: Pick<TutorFee, "status" | "overdue" | "unpaid">,
): { label: string; tone: Tone } {
  if (fee.unpaid) return { label: "Unpaid", tone: "error" };
  if (fee.overdue && (fee.status === "DUE" || fee.status === "PARTIAL"))
    return { label: "Overdue", tone: "error" };
  return FEE_STATUS_META[fee.status];
}

export function paymentMethodText(method: TutorFeePayment["method"]): string {
  return method === "SSLCOMMERZ"
    ? "Online (SSLCommerz)"
    : PAYMENT_METHOD_LABEL[method];
}
