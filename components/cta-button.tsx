import Link from 'next/link';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { cn } from '@/lib/utils';

type CtaButtonProps = Omit<React.ComponentProps<typeof Link>, 'as' | 'href'> & {
  href: string;
  containerClassName?: string;
};

export function CtaButton({
  children,
  className,
  containerClassName,
  ...props
}: CtaButtonProps) {
  return (
    <HoverBorderGradient
      as={Link}
      {...props}
      containerClassName={cn(
        'rounded-full border-1 [--hbg-bg:transparent] [--hbg-gradient:#F8F7FF] [--hbg-highlight:white] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]',
        containerClassName
      )}
      className={cn(
        'flex items-center justify-between gap-4 whitespace-nowrap bg-transparent py-1 pr-1 pl-6 font-bold text-white text-lg',
        className
      )}
    >
      {children}
      <span
        aria-hidden
        className='flex size-10 shrink-0 items-center justify-center rounded-full bg-white'
      >
        <span
          aria-hidden
          className='size-3.5 shrink-0 bg-[var(--color-primary-core)] [mask:url(/assets/ic/ic-arrow-up.png)_center/contain_no-repeat]'
        />
      </span>
    </HoverBorderGradient>
  );
}
