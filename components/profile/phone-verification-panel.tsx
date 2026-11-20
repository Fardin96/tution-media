"use client";

import { useState } from "react";
import { errorCodeMessage } from "@/lib/api-errors";
import { ApiError } from "@/lib/profile";
import { useSendPhoneOtp, useVerifyPhoneOtp } from "@/lib/phone-verification";
import { PhoneVerifier } from "./phone-verifier";

export interface PhoneVerificationPanelProps {
  /** E.164, +8801... */
  phoneNumber: string;
  /** Set when this number is already verified, from the profile or the wizard. */
  verifiedAt: string | null;
  onVerified?: (result: { phoneNumber: string; verifiedAt: string }) => void;
  onChangeNumber?: () => void;
  autoFocus?: boolean;
}

const FALLBACK = "We couldn't check that. Try again.";
const DEFAULT_COOLDOWN_SECONDS = 60;
// An earlier code is valid for 5 minutes. After a cooldown reply, about 4 minutes remain once the cooldown ends.
const CODE_LIFETIME_AFTER_COOLDOWN_MS = 4 * 60_000;
const COOLDOWN_NOTICE = "We sent a code a moment ago. Enter it below.";

/** Sends and checks the code for one number. Parents remount it with a key when the number changes. */
export function PhoneVerificationPanel({
  phoneNumber,
  verifiedAt,
  onVerified,
  onChangeNumber,
  autoFocus,
}: PhoneVerificationPanelProps) {
  const send = useSendPhoneOtp();
  const verify = useVerifyPhoneOtp();
  const [sentTo, setSentTo] = useState<{
    phoneNumber: string;
    expiresAt: string;
    resendAfter: string;
  } | null>(null);
  const [verifiedHere, setVerifiedHere] = useState<{
    phoneNumber: string;
    verifiedAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A code sent for another number does not count for this one.
  const sent = sentTo?.phoneNumber === phoneNumber ? sentTo : null;
  const verifiedNow =
    verifiedHere?.phoneNumber === phoneNumber
      ? verifiedHere.verifiedAt
      : verifiedAt;

  const onSend = () => {
    setError(null);
    setNotice(null);
    send.mutate(phoneNumber, {
      onSuccess: (result) =>
        setSentTo({
          phoneNumber,
          expiresAt: result.expiresAt,
          resendAfter: result.resendAfter,
        }),
      onError: (err) => {
        // A code went out moments ago (another tab, or a reload). Move to the enter-code step rather than an error.
        if (err instanceof ApiError && err.code === "OTP_COOLDOWN") {
          const resendAfter = Date.now() + retryAfterSeconds(err) * 1000;
          setSentTo({
            phoneNumber,
            resendAfter: new Date(resendAfter).toISOString(),
            expiresAt: new Date(
              resendAfter + CODE_LIFETIME_AFTER_COOLDOWN_MS,
            ).toISOString(),
          });
          setNotice(COOLDOWN_NOTICE);
          return;
        }
        setError(errorCodeMessage(err) ?? FALLBACK);
      },
    });
  };

  const onVerify = (code: string) => {
    if (verify.isPending) return;
    setError(null);
    setNotice(null);
    verify.mutate(
      { phoneNumber, code },
      {
        onSuccess: (result) => {
          setVerifiedHere({
            phoneNumber: result.phoneNumber,
            verifiedAt: result.verifiedAt,
          });
          onVerified?.({
            phoneNumber: result.phoneNumber,
            verifiedAt: result.verifiedAt,
          });
        },
        onError: (err) => {
          // The code can no longer be used. Ending its expiry now shows the expired state; resend still waits for the cooldown.
          if (
            err instanceof ApiError &&
            (err.code === "OTP_EXPIRED" || err.code === "OTP_TOO_MANY_ATTEMPTS")
          ) {
            setSentTo(
              (prev) =>
                prev && { ...prev, expiresAt: new Date().toISOString() },
            );
            return;
          }
          setError(errorCodeMessage(err) ?? FALLBACK);
        },
      },
    );
  };

  return (
    <PhoneVerifier
      phoneNumber={phoneNumber}
      verifiedAt={verifiedNow}
      sent={sent}
      sending={send.isPending}
      verifying={verify.isPending}
      error={error}
      notice={notice}
      onSend={onSend}
      onVerify={onVerify}
      onChangeNumber={onChangeNumber}
      autoFocus={autoFocus}
    />
  );
}

function retryAfterSeconds(err: ApiError): number {
  const value = err.details?.retryAfterSeconds;
  return typeof value === "number" && value > 0
    ? value
    : DEFAULT_COOLDOWN_SECONDS;
}
