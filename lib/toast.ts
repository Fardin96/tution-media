import { toast } from "sonner";
import { errorCodeMessage } from "./api-errors";
import { ApiError } from "./profile";
import { requestPhoneVerify } from "./phone-verify-request";

export function toastSuccess(message: string) {
  toast.success(message);
}

/** A phone check refused the action: the switch is on and the number is unverified. */
function needsPhoneVerification(err: unknown): err is ApiError {
  if (!(err instanceof ApiError)) return false;
  if (err.code === "PHONE_VERIFICATION_REQUIRED") return true;
  const missing = err.details?.missing;
  return (
    err.code === "PROFILE_INCOMPLETE" &&
    Array.isArray(missing) &&
    missing.length === 1 &&
    missing[0] === "phone_verification"
  );
}

/**
 * Shows the catalogue copy when `err` is an ApiError with a known code; otherwise `fallback`.
 * A phone check that refused the action gets a "Verify now" button that opens the dialog.
 */
export function toastError(fallback: string, err?: unknown) {
  if (needsPhoneVerification(err)) {
    const message =
      err.code === "PHONE_VERIFICATION_REQUIRED" && err.message
        ? err.message
        : (errorCodeMessage(err) ?? fallback);
    toast.error(message, {
      id: "phone-verification-required",
      action: { label: "Verify now", onClick: requestPhoneVerify },
    });
    return;
  }
  toast.error(errorCodeMessage(err) ?? fallback);
}
