export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-core)]";

const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold whitespace-nowrap transition-[background-color,box-shadow,color,scale] duration-150 ease-out active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 motion-reduce:transition-none ${focusRing}`;

export const primaryButton = `${button} bg-[var(--color-primary-core)] text-[var(--color-neutral-white)] shadow-[0_1px_2px_rgb(0_0_0/0.08),0_8px_20px_-8px_color-mix(in_oklab,var(--color-primary-core)_60%,transparent)] hover:bg-[var(--color-primary-hover)]`;

export const secondaryButton = `${button} bg-[var(--color-neutral-white)] text-[var(--color-neutral-charcoal)] shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_1px_2px_rgb(0_0_0/0.06)] hover:bg-[var(--color-neutral-off-white)]`;

export const ghostButton = `${button} px-4 text-[var(--color-primary-core)] hover:bg-[var(--color-secondary-sky)] hover:text-[var(--color-primary-deep)]`;

/** 24px radius surface; children with 8px inset use 16px radii. */
export const card =
  "rounded-[24px] bg-[var(--color-neutral-white)] shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.08)]";
