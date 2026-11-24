import type { ReactNode } from "react";
import { BackToTop } from "@/components/back-to-top";
import { PhoneVerifyHost } from "@/components/profile/phone-verify-host";
import { ReturnToBanner } from "@/components/ui/return-to-banner";

// Dashboards are long lists, so the button appears after half a screen rather than a full one.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      {/* After the content: the banner floats, and its spacer must sit at the end of the page. */}
      <PhoneVerifyHost />
      <ReturnToBanner />
      <BackToTop threshold={0.5} />
    </>
  );
}
