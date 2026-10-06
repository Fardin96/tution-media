import Image from "next/image";

type TagLineProps = {
  line?: string;
};

export default function TagLine({
  line = "Your #1 Platform for Tutors",
}: TagLineProps) {
  return (
    <div
      data-testid="chip"
      className="rounded-chip border-chip-border animate-fade-up inline-flex items-center gap-2 border bg-white px-6 py-2"
      style={{ animationDelay: "0ms" }}
    >
      <Image
        src="/assets/ic/ic-briefcase.png"
        alt="Masters Hub"
        className="h-auto w-5"
        width={24}
        height={24}
        priority
      />
      <span className="text-primary-900 text-base leading-[1.5] font-normal">
        {line}
      </span>
    </div>
  );
}
