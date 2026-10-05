'use client';

import Link from 'next/link';
import Image from 'next/image';
import { CtaButton } from '@/components/cta-button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetClose,
} from '@/components/ui/sheet';
import { HugeiconsIcon } from '@hugeicons/react';
import { Menu02Icon } from '@hugeicons/core-free-icons';

const navLinks = [
  { href: '/categories', label: 'Categories' },
  { href: '/talents', label: 'Talents' },
  { href: '/about-us', label: 'About Us' },
  { href: '/admin', label: 'Admin' },
];

export function Navbar() {
  return (
    <header className='sticky flex items-center top-[36px] z-50 -mb-[72px] w-full bg-transparent'>
      <nav className='mx-auto flex h-[72px] w-full max-w-[1280px] items-center gap-6 px-4 sm:px-6 lg:justify-between lg:px-8'>
        <Link href='/' className='mx-auto flex shrink-0 items-center gap-2 lg:mx-0'>
          <Image
            src='/assets/ic-demo/Icon.png'
            alt='Masters Hub'
            className='h-11 w-auto sm:h-14'
            width={183}
            height={17}
            priority
          />
        </Link>

        <div className='hidden items-center gap-6 lg:flex xl:gap-8'>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className='whitespace-nowrap text-lg font-regular text-[var(--color-neutral-gray)] transition-colors hover:text-[var(--color-neutral-charcoal)]'
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className='hidden shrink-0 lg:block'>
          <CtaButton href='/register'>Register Now</CtaButton>
        </div>

        <Sheet>
          <SheetTrigger asChild className='lg:hidden'>
            <button
              type='button'
              className='absolute right-4 inline-flex items-center justify-center rounded-lg p-2.5 sm:right-6 text-[var(--color-neutral-charcoal)] transition-colors hover:bg-black/5'
              aria-label='Open menu'
            >
              <HugeiconsIcon
                icon={Menu02Icon}
                className='size-6'
                strokeWidth={2}
              />
            </button>
          </SheetTrigger>
          <SheetContent side='right' className='max-w-sm bg-white data-[side=right]:w-full'>
            <div className='flex h-full flex-col px-6 pt-12'>
              <div className='flex flex-col gap-6'>
                {navLinks.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className='text-lg font-medium text-[var(--color-neutral-charcoal)] transition-colors hover:text-[var(--color-secondary-sky-deep)]'
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </div>
              <div className='mt-auto pb-8'>
                <SheetClose asChild>
                  <CtaButton
                    href='/register'
                    containerClassName='w-full border-[var(--color-neutral-charcoal)]'
                    className='w-full py-3 text-[var(--color-neutral-charcoal)]'
                  >
                    Register Now
                  </CtaButton>
                </SheetClose>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
