import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountsPage } from "@/components/admin/accounts-page";

export const metadata: Metadata = { title: "Accounts · Masters Hub" };

export default function AdminAccountsRoute() {
  return (
    <Suspense>
      <AccountsPage />
    </Suspense>
  );
}
