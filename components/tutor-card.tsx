import Image from "next/image";
import { IconStarFilled } from "@tabler/icons-react";
import { categoryLabel, type Tutor } from "@/lib/tutors";
import { cn } from "@/lib/utils";

type TutorCardProps = {
  tutor: Tutor;
  selected: boolean;
  onSelect: () => void;
};

export function TutorCard({ tutor, selected, onSelect }: TutorCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex h-full w-full flex-col items-center rounded-[20px] border bg-[var(--color-neutral-white)] px-[15px] pt-[23px] pb-[23px] text-center transition-[border-color,box-shadow] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-core)] focus-visible:ring-offset-2",
        selected
          ? "border-[var(--color-primary-core)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary-core)_12%,transparent),0_16px_32px_-12px_color-mix(in_oklab,var(--color-primary-core)_40%,transparent)]"
          : "border-[var(--color-card-border)]",
      )}
    >
      <Image
        src={tutor.avatar}
        alt=""
        width={64}
        height={64}
        className="size-16 rounded-full outline-1 -outline-offset-1 outline-[oklch(0_0_0/0.1)]"
      />

      <span className="mt-[7px] flex items-center gap-2.5 px-2.5">
        <IconStarFilled
          aria-hidden
          className="size-[15px] text-[var(--color-semantic-warning)]"
        />
        <span className="flex items-center gap-1">
          <span className="text-sm/[21px] font-semibold text-[var(--color-neutral-charcoal)]">
            {tutor.rating.toFixed(1)}
          </span>
          <span className="text-xs/[21px] text-[var(--color-neutral-gray)]">
            ({tutor.reviews})<span className="sr-only"> reviews</span>
          </span>
        </span>
      </span>

      <span className="mt-[7px] text-xl leading-[1.5] font-bold text-[var(--color-neutral-charcoal)]">
        {tutor.name}
      </span>
      <span className="text-xs leading-[1.5] text-[var(--color-neutral-gray)]">
        {tutor.position}
      </span>

      <span className="mt-auto flex flex-wrap justify-center gap-1 pt-[21px]">
        {tutor.categories.map((id) => (
          <span
            key={id}
            className="rounded-[20px] border border-[var(--color-card-border)] bg-[var(--color-neutral-white)] px-[11px] py-[3px] text-xs leading-[1.5] text-[var(--color-tab-inactive)]"
          >
            {categoryLabel[id]}
          </span>
        ))}
      </span>
    </button>
  );
}
