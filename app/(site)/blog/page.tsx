import type { Metadata } from "next";
import { BlogIndex } from "@/components/blog/blog-index";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Blog · Masters Hub" };

export default function BlogPage() {
  return (
    <>
      <BlogIndex />
      <SiteFooter />
    </>
  );
}
