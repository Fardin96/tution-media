'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';

// ponytail: sizes estimated from the design screenshot (Figma MCP was rate-limited); swap for exact specs.
const SKILLS = [
  'e.g. SSC package',
  'e.g. Math Tutor',
  'e.g. English Specialist',
  'e.g. Physics Teacher',
];
const PLACES = [
  'e.g. Gulshan, Dhaka',
  'e.g. Uttara, Dhaka',
  'e.g. Motijheel, Dhaka',
];

const field = 'flex min-h-12 flex-1 items-center gap-2 ps-4 pe-2';

export default function SearchBar({ className = '' }: { className?: string }) {
  const router = useRouter();

  return (
    <div className={`@container w-full max-w-[640px] ${className}`}>
      {/* action/method keep search working before hydration */}
      <form
        role='search'
        action='/talents'
        method='get'
        onSubmit={(e) => {
          e.preventDefault();
          const params = new URLSearchParams();
          for (const [k, v] of new FormData(e.currentTarget)) {
            if (typeof v === 'string' && v.trim()) params.set(k, v.trim());
          }
          router.push(`/talents${params.size ? `?${params}` : ''}`);
        }}
        className='flex flex-col gap-1 rounded-[var(--border-radius-24)] border border-chip-border bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.06)] focus-within:ring-2 focus-within:ring-[var(--color-primary-core)]/30 @xl:flex-row @xl:items-center @xl:rounded-chip'
      >
        <div className={field}>
          <Image src='/assets/ic/ic-search.png' alt='' width={20} height={20} />
          <PlaceholdersAndVanishInput
            name='q'
            type='search'
            label='Skill or role'
            placeholders={SKILLS}
          />
        </div>

        <div
          className={`${field} border-t border-chip-border @xl:border-t-0 @xl:border-s`}
        >
          <Image
            src='/assets/ic/ic-pin-map.png'
            alt=''
            width={18}
            height={20}
          />
          <PlaceholdersAndVanishInput
            name='location'
            label='Location'
            autoComplete='address-level2'
            placeholders={PLACES}
          />
        </div>

        <button
          type='submit'
          className='min-h-12 shrink-0 rounded-chip bg-[var(--color-primary-core)] px-8 text-base font-semibold whitespace-nowrap text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--color-primary-hover)] active:scale-[0.97] active:bg-[var(--color-primary-pressed)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-core)] motion-reduce:active:scale-100'
        >
          Search
        </button>
      </form>
    </div>
  );
}
