import { toast } from "sonner";
import { errorCodeMessage } from "./api-errors";

export function toastSuccess(message: string) {
  toast.success(message);
}

/** Shows the catalogue copy when `err` is an ApiError with a known code; otherwise `fallback`. */
export function toastError(fallback: string, err?: unknown) {
  toast.error(errorCodeMessage(err) ?? fallback);
}
