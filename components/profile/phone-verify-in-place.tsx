"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { profileOf, useMeAccount } from "@/lib/profile";
import { invalidatePhoneVerification } from "@/lib/query-keys";

const PhoneVerifyDialog = dynamic(() =>
  import("./phone-verify-dialog").then((m) => m.PhoneVerifyDialog),
);

/**
 * Verifies the signed-in account's phone without leaving the form. The dialog loads on first
 * open and then stays mounted, so its exit fade plays.
 */
export function PhoneVerifyInPlace({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const me = useMeAccount();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);

  const profile = me.data ? profileOf(me.data) : null;
  if (!(open || opened) || !profile?.phoneNumber) return null;

  return (
    <PhoneVerifyDialog
      open={open}
      onOpenChange={onOpenChange}
      currentPhone={profile.phoneNumber}
      currentVerifiedAt={profile.phoneVerifiedAt}
      onVerified={() => void invalidatePhoneVerification(queryClient)}
    />
  );
}
