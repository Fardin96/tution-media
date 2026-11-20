import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { normalizeBdPhone, type ApiError } from "./profile";
import { invalidatePhoneVerification, queryKeys } from "./query-keys";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type PhoneVerificationStatus = Schemas["PhoneVerificationStatus"];
export type PhoneOtpSent = Schemas["PhoneOtpSent"];
export type PhoneVerified = Schemas["PhoneVerified"];
export type PendingPhoneVerification = Schemas["PendingPhoneVerification"];

export const NEW_NUMBER_ERROR = "Enter a Bangladeshi mobile number";

/**
 * Reads a number typed by the user. Returns E.164 or an inline error.
 * Accepts the same forms as normalizeBdPhone (01XXXXXXXXX, 8801…, +8801…, with spaces or dashes).
 */
export function parseNewPhone(
  input: string,
): { phoneNumber: string } | { error: string } {
  const phoneNumber = normalizeBdPhone(input.trim());
  return phoneNumber ? { phoneNumber } : { error: NEW_NUMBER_ERROR };
}

/**
 * The verified-at time to show for `phone`. The first source with that number wins: a check made in
 * this session, then the latest one the server still holds for an account without a profile yet.
 */
export function verifiedAtFor(
  phone: string | null,
  ...sources: ({ phoneNumber: string; verifiedAt: string } | null | undefined)[]
): string | null {
  if (!phone) return null;
  for (const source of sources) {
    if (source && source.phoneNumber === phone) return source.verifiedAt;
  }
  return null;
}

export const phoneVerificationApi = {
  status: () => unwrap(client.GET("/api/v1/phone-verification")),

  send: (phoneNumber: string) =>
    unwrap(
      client.POST("/api/v1/phone-verification/send", {
        body: { phoneNumber },
      }),
    ),

  verify: (phoneNumber: string, code: string) =>
    unwrap(
      client.POST("/api/v1/phone-verification/verify", {
        body: { phoneNumber, code },
      }),
    ),
};

/** Whether the caller's role must verify its phone, and the number and time on the profile. */
export function usePhoneVerificationStatus() {
  return useQuery({
    queryKey: queryKeys.phoneVerification.status,
    queryFn: () => phoneVerificationApi.status(),
  });
}

/** Not optimistic: the response carries the resend time the UI counts down to. */
export function useSendPhoneOtp() {
  return useMutation<PhoneOtpSent, ApiError, string>({
    mutationFn: (phoneNumber) => phoneVerificationApi.send(phoneNumber),
  });
}

export function useVerifyPhoneOtp() {
  const queryClient = useQueryClient();
  return useMutation<
    PhoneVerified,
    ApiError,
    { phoneNumber: string; code: string }
  >({
    mutationFn: ({ phoneNumber, code }) =>
      phoneVerificationApi.verify(phoneNumber, code),
    onSuccess: () => invalidatePhoneVerification(queryClient),
  });
}
