"use client";

import Image from "next/image";
import Link from "next/link";
import { MeshGradient } from "@/components/mesh-gradient/mesh-gradient";
import { ArrowLinkButton } from "@/components/arrow-link-button";

const socialLinks = [
  {
    name: "Instagram",
    href: "https://instagram.com",
    icon: "/assets/ic/social/insta.png",
  },
  {
    name: "Telegram",
    href: "https://telegram.org",
    icon: "/assets/ic/social/telegram.png",
  },
  {
    name: "TikTok",
    href: "https://tiktok.com",
    icon: "/assets/ic/social/tiktok.png",
  },
  {
    name: "YouTube",
    href: "https://youtube.com",
    icon: "/assets/ic/social/utube.png",
  },
];

const quickLinks = [
  { label: "Find a Tutor", href: "/#tutors" },
  { label: "Subject Categories", href: "/#categories" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Tuition Packages", href: "/#categories" },
  { label: "Frequently Asked Questions", href: "/#faq" },
];

const tutorLinks = [
  { label: "Become a Tutor", href: "/#how-it-works" },
  { label: "Tutor Guidelines", href: "/#faq" },
  { label: "Verification Process", href: "/#faq" },
  { label: "Code of Conduct", href: "/#faq" },
  { label: "Tuition Opportunities", href: "/#tutors" },
];

const legalLinks = [
  { label: "About Us", href: "/about-us" },
  { label: "Blogs & Guidance", href: "/blogs" },
  { label: "Terms and Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Contact Support", href: "/contact" },
];

export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden bg-[var(--color-neutral-off-white)]">
      {/* CTA Card Banner on top of footer */}
      <div className="relative mx-auto w-full max-w-[77.5rem] px-6 pt-14 sm:pt-16 lg:pt-[88px]">
        <div className="relative overflow-hidden rounded-[24px] bg-[var(--color-neutral-off-white)] sm:rounded-[32px]">
          <MeshGradient
            as="div"
            animated={false}
            className="px-6 pt-16 pb-12 text-center sm:px-12 lg:pt-[88px] lg:pb-14"
          >
            <h2 className="mx-auto max-w-2xl text-2xl leading-[1.2] font-medium text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl md:text-4xl lg:text-[2.5rem]">
              Find your ideal tutor and unlock your full potential today
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-6 text-pretty text-[var(--color-neutral-charcoal)]">
              Discover trusted, subject-specialist mentors tailored to your
              syllabus, learning pace, and academic goals.
            </p>
            <div className="mt-8 flex justify-center sm:mt-10">
              <ArrowLinkButton href="/register" variant="solid">
                Get Started
              </ArrowLinkButton>
            </div>
          </MeshGradient>
        </div>
      </div>

      {/* Main Footer Links & Information */}
      <div className="relative mx-auto w-full max-w-[77.5rem] px-6 pt-16 pb-12 sm:pt-20 lg:pt-[120px]">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[24rem_auto_auto_auto] lg:justify-between lg:gap-x-10">
          {/* Brand & Contact Information */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="inline-block shrink-0">
              <Image
                src="/assets/ic-demo/Icon-blue.png"
                alt="Masters Hub"
                className="h-14 w-auto"
                width={218}
                height={32}
              />
            </Link>
            <p className="text-sm leading-relaxed text-pretty text-[var(--color-text-secondary)] sm:text-base">
              Masters Hub is Bangladesh&apos;s trusted platform connecting
              students and guardians with verified, top-tier academic tutors for
              school, college, and test prep.
            </p>
            <div className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]">
              <p className="text-base leading-6 text-[var(--color-neutral-charcoal)]">
                <span className="font-semibold">Corporate Office:</span> House
                42, Road 11, Block D, Banani, Dhaka 1213, Bangladesh
              </p>
              <p className="flex flex-col text-base leading-[27px] text-[var(--color-neutral-charcoal)]">
                <span className="text-lg font-semibold">Phone:</span> +880
                1700-000000
              </p>
              <p>
                <span className="text-lg font-semibold">Email:</span>{" "}
                support@mastershub.com
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-[13px]">
            <h3 className="text-xl leading-7 font-bold text-[var(--color-neutral-charcoal)]">
              Quick Links
            </h3>
            <ul className="flex flex-col gap-[13px]">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-base leading-6 text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-primary-core)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Tutors */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xl leading-7 font-bold text-[var(--color-neutral-charcoal)]">
              For Tutors
            </h3>
            <ul className="flex flex-col gap-2">
              {tutorLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-primary-core)] sm:text-base"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* About & Legal */}
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-bold text-[var(--color-neutral-charcoal)] sm:text-lg">
              About &amp; Legal
            </h3>
            <ul className="flex flex-col gap-2.5">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-primary-core)] sm:text-base"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Divider, Copyright & Social Icons */}
        <div className="mt-16 lg:mt-[100px]">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-base text-[var(--color-neutral-charcoal)]">
              &copy; {new Date().getFullYear()} Masters Hub. All rights
              reserved.
            </p>

            {/* Social Media Links */}
            <div className="flex items-center gap-0.5 sm:-mr-2.5">
              {socialLinks.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow us on ${item.name}`}
                  className="flex size-11 items-center justify-center rounded-full text-[var(--color-primary-deep)] transition-all duration-150 outline-none hover:scale-110 hover:bg-[var(--color-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-core)] active:scale-95"
                >
                  <Image
                    src={item.icon}
                    alt=""
                    width={24}
                    height={24}
                    className="size-6 object-contain"
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom glow: the hero mesh, flipped */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[540px] lg:h-[max(1080px,18vw)]"
      >
        <MeshGradient
          as="div"
          animated={false}
          className="size-full rotate-180"
        />
      </div>
    </footer>
  );
}
