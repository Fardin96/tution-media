import type { Metadata } from "next";
import { BlogIndex } from "@/components/blog/blog-index";
import { SiteFooter } from "@/components/site-footer";
import { getBlogFirstPage } from "@/lib/blog";

export const metadata: Metadata = { title: "Blog · Masters Hub" };

// Matches the fetch's 5-minute revalidate, so the route is never cached without a deadline.
export const revalidate = 300;

export default async function BlogPage() {
  const first = await getBlogFirstPage();
  return (
    <>
      <BlogIndex initialPage={first.ok ? first.data : undefined} />
      <SiteFooter />
    </>
  );
}
