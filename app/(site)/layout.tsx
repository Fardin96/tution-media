import { BackToTop } from "@/components/back-to-top";
import { Navbar } from "@/components/navbar";
import { hiddenAnchors, visibleLinks } from "@/lib/site-content";
import { getSiteContent } from "@/lib/site-content.server";

// Marketing pages get the navbar; (auth) pages are full-screen without it.
// Lenient: blog posts render here on first visit, with no earlier copy to fall back to. The
// prerendered pages use the strict read themselves, so an API failure keeps their last good copy.
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const content = await getSiteContent();
  return (
    <>
      <Navbar
        links={visibleLinks(content.nav.links, hiddenAnchors(content))}
        cta={content.nav.cta}
      />
      {children}
      <BackToTop />
    </>
  );
}
