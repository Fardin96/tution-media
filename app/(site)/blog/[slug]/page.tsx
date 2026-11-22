import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostView } from "@/components/blog/blog-post-view";
import { SiteFooter } from "@/components/site-footer";
import { getBlogFirstPage, getBlogPost } from "@/lib/blog";

// Matches the fetch's 5-minute revalidate, so the route is never cached without a deadline.
export const revalidate = 300;

// The first page of posts is prerendered at build time. Any other slug renders on its first
// visit and is then cached. With no API at build time the list is empty and nothing fails.
export async function generateStaticParams() {
  try {
    const first = await getBlogFirstPage();
    if (!first.ok) return [];
    return first.data.posts.map((post) => ({ slug: post.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post.ok) return { title: "Blog · Masters Hub" };
  return {
    title: `${post.data.title} · Masters Hub`,
    description: post.data.excerpt ?? undefined,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post.ok && post.status === 404) notFound();
  return (
    <>
      <BlogPostView slug={slug} initialPost={post.ok ? post.data : undefined} />
      <SiteFooter />
    </>
  );
}
