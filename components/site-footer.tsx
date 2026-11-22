import { Footer } from "@/components/footer";
import { hiddenAnchors } from "@/lib/site-content";
import {
  getSiteContent,
  getSiteContentForPage,
} from "@/lib/site-content.server";

/**
 * The marketing footer, with its copy and links from site content. `strict` on prerendered
 * pages, so an API failure keeps their last good copy instead of caching default copy.
 */
export async function SiteFooter({ strict = false }: { strict?: boolean }) {
  const content = strict
    ? await getSiteContentForPage()
    : await getSiteContent();
  return (
    <Footer
      footer={content.footer}
      cta={content.cta_banner}
      hiddenAnchors={[...hiddenAnchors(content)]}
    />
  );
}
