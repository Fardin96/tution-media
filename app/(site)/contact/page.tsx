import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SitePageView } from "@/components/site-page";
import {
  getSiteContentForPage,
  getSitePageForPage,
} from "@/lib/site-content.server";

const linkClass =
  "inline-flex min-h-11 items-center rounded-md px-1 -mx-1 font-medium text-[var(--color-primary-deep)] underline decoration-1 underline-offset-4 hover:decoration-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-core)] focus-visible:ring-offset-2";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getSitePageForPage("contact");
  return {
    title: `${page.title} · Masters Hub`,
    description: page.description,
  };
}

export default async function ContactPage() {
  const page = await getSitePageForPage("contact");
  const { footer } = await getSiteContentForPage();
  return (
    <>
      <SitePageView page={page}>
        <dl className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium text-[var(--color-text-secondary)]">
              Office
            </dt>
            <dd className="text-[var(--color-neutral-charcoal)]">
              {footer.address}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium text-[var(--color-text-secondary)]">
              Phone
            </dt>
            <dd>
              <a
                href={`tel:${footer.phone.replace(/[\s-]/g, "")}`}
                className={linkClass}
              >
                {footer.phone}
              </a>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium text-[var(--color-text-secondary)]">
              Email
            </dt>
            <dd>
              <a href={`mailto:${footer.email}`} className={linkClass}>
                {footer.email}
              </a>
            </dd>
          </div>
        </dl>
      </SitePageView>
      <SiteFooter strict />
    </>
  );
}
