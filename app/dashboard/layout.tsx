import type { ReactNode } from "react";
import { BackToTop } from "@/components/back-to-top";

// Dashboards are long lists, so the button appears after half a screen rather than a full one.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <BackToTop threshold={0.5} />
    </>
  );
}
