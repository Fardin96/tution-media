import type { Metadata } from "next";
import { TeamPage } from "@/components/admin/team-page";

export const metadata: Metadata = { title: "Admin team · Masters Hub" };

export default function AdminTeamRoute() {
  return <TeamPage />;
}
