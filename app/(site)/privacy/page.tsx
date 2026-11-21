import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SitePageView } from "@/components/site-page";
import { getSitePage } from "@/lib/site-content.server";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getSitePage("privacy");
  return {
    title: `${page.title} · Masters Hub`,
    description: page.description,
  };
}

export default async function PrivacyPage() {
  const page = await getSitePage("privacy");
  return (
    <>
      <SitePageView page={page} />
      <SiteFooter />
    </>
  );
}
