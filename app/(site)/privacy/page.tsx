import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SitePageView } from "@/components/site-page";
import { getSitePageForPage } from "@/lib/site-content.server";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getSitePageForPage("privacy");
  return {
    title: `${page.title} · Masters Hub`,
    description: page.description,
  };
}

export default async function PrivacyPage() {
  const page = await getSitePageForPage("privacy");
  return (
    <>
      <SitePageView page={page} />
      <SiteFooter strict />
    </>
  );
}
