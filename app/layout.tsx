import type { Metadata } from "next";
import { Geist_Mono, Manrope, Noto_Sans_Bengali } from "next/font/google";
import { preconnect } from "react-dom";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { cn } from "@/lib/utils";
import { MEDIA_URL_PREFIX } from "@/lib/media";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";
import { getSiteContent } from "@/lib/site-content.server";

// No `fallback` here: under Turbopack, passing one drops next/font's generated size-adjusted
// "Manrope Fallback" face, so text reflowed when Manrope arrived. The system stack lives in
// --font-sans (globals.css).
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

// Manrope has no Bengali, so the ৳ sign comes from this face. Its unicode-range keeps the
// file off the wire until a Bengali glyph is on the page.
const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali",
  preload: false,
  display: "swap",
});

// Mono appears on a few pages only, so don't preload it on every page.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

/** The media bucket's origin, for an early connection. Null when unset, malformed or not https. */
function mediaOrigin(): string | null {
  if (!MEDIA_URL_PREFIX) return null;
  try {
    const url = new URL(MEDIA_URL_PREFIX);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getSiteContent();
  return { title: seo.title, description: seo.description };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const media = mediaOrigin();
  if (media) preconnect(media);
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={cn(
        "h-full",
        "scroll-smooth motion-reduce:scroll-auto",
        "antialiased",
        geistMono.variable,
        "font-sans",
        manrope.variable,
        notoBengali.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
