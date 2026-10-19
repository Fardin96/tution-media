import { Navbar } from "@/components/navbar";

// Marketing pages get the navbar; (auth) pages are full-screen without it.
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
