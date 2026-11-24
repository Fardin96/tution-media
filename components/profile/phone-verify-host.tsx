"use client";

import { useState } from "react";
import { usePhoneVerifyRequests } from "@/lib/phone-verify-request";
import { PhoneVerifyInPlace } from "./phone-verify-in-place";

/**
 * Opens the phone verify dialog for any toast or button that asks for it. Nothing loads until the
 * first request, so the dashboard pays nothing for it.
 */
export function PhoneVerifyHost() {
  const [opened, setOpened] = useState(false);
  const [open, setOpen] = useState(false);
  usePhoneVerifyRequests(() => {
    setOpened(true);
    setOpen(true);
  });
  if (!opened) return null;
  return <PhoneVerifyInPlace open={open} onOpenChange={setOpen} />;
}
