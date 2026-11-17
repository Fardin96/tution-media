import { useQuery } from "@tanstack/react-query";
import { profileApi } from "./profile";
import { queryKeys } from "./query-keys";

/**
 * The signed-in admin's own row. The session cookie only says ADMIN, so super-admin rights and
 * approval state come from GET /me (adminUser.adminRole / adminUser.status).
 */
export function useAdminMe() {
  const me = useQuery({ queryKey: queryKeys.me, queryFn: profileApi.me });
  const adminUser = me.data?.adminUser ?? null;
  return {
    ...me,
    adminUser,
    isSuperAdmin:
      adminUser?.adminRole === "SUPER_ADMIN" && adminUser.status === "ACTIVE",
    isActive: adminUser?.status === "ACTIVE",
  };
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

/** "12 Nov 2026, 14:05" in Dhaka time. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_TIME_FORMAT.format(date);
}

/** Money fields arrive as decimal strings ("1500.00"). */
export function formatAmount(value: string | number): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return String(value);
  return `৳${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(amount)}`;
}
