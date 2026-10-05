import Image from 'next/image';

type TagLineProps = {
  line?: string;
};

export default function TagLine({ line }: TagLineProps) {
  return (
    <div
      data-testid='chip'
      className='inline-flex items-center gap-2 rounded-chip border border-chip-border bg-white px-6 py-2 animate-fade-up'
      style={{ animationDelay: '0ms' }}
    >
      <Image
        src='/assets/ic/ic-briefcase.png'
        alt='Masters Hub'
        width={24}
        height={24}
        priority
      />
      <span className='text-base font-normal leading-[1.5] text-primary-900'>
        {!line ? 'Your #1 Platform for Tutors' : line}
      </span>
    </div>
  );
}
