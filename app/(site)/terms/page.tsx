import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SitePageView } from "@/components/site-page";
import { getSitePage } from "@/lib/site-content.server";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getSitePage("terms");
  return {
    title: `${page.title} · Masters Hub`,
    description: page.description,
  };
}

export default async function TermsPage() {
  const page = await getSitePage("terms");
  return (
    <>
      <SitePageView page={page} />
      <SiteFooter />
    </>
  );
}
