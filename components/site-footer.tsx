import { Footer } from "@/components/footer";
import { hiddenAnchors } from "@/lib/site-content";
import { getSiteContent } from "@/lib/site-content.server";

/** The marketing footer, with its copy and links from site content. */
export async function SiteFooter() {
  const content = await getSiteContent();
  return (
    <Footer
      footer={content.footer}
      cta={content.cta_banner}
      hiddenAnchors={[...hiddenAnchors(content)]}
    />
  );
}
