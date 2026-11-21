import { BlogPostView } from "@/components/blog/blog-post-view";
import { SiteFooter } from "@/components/site-footer";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <BlogPostView slug={slug} />
      <SiteFooter />
    </>
  );
}
