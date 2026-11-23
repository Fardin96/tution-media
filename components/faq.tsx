"use client";

import { Accordion } from "radix-ui";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { SectionHeader } from "@/components/section-header";
import type { FaqBlock } from "@/lib/site-content";

export function Faq({ content }: { content: FaqBlock }) {
  // Two stacked columns on phones, side by side from lg; the first column takes the extra item.
  const split = Math.ceil(content.items.length / 2);
  const columns = [content.items.slice(0, split), content.items.slice(split)];
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-[calc(var(--navbar-top-offset)+var(--navbar-height))] bg-[var(--color-neutral-white)] px-6 py-14 sm:py-16 lg:py-[88px]"
    >
      <div className="mx-auto flex w-full max-w-[77.5rem] flex-col">
        <SectionHeader
          align="start"
          titleId="faq-title"
          title={content.title}
        />

        {/* One root so only one answer is open at a time; openIndex starts open (Figma: 04).
            Each column is its own stack, so opening an item only pushes its own column. */}
        <Accordion.Root
          type="single"
          collapsible
          defaultValue={
            content.openIndex === null
              ? undefined
              : `faq-${content.openIndex + 1}`
          }
          className="mt-8 grid items-start gap-4 lg:mt-[35px] lg:grid-cols-2 lg:gap-[30px]"
        >
          {columns.map((col, c) => (
            <div key={c} className="flex flex-col gap-4 lg:gap-[30px]">
              {col.map((f, i) => (
                <FaqItem key={i} faq={f} n={c * split + i + 1} />
              ))}
            </div>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}

function FaqItem({ faq, n }: { faq: FaqBlock["items"][number]; n: number }) {
  return (
    <Accordion.Item
      value={`faq-${n}`}
      className="group/faq rounded-[20px] border border-[var(--color-card-border)] bg-[var(--color-neutral-white)] transition-[background-color,border-color,box-shadow] duration-200 ease-out data-[state=open]:border-[color-mix(in_oklab,var(--color-primary-core)_35%,white)] data-[state=open]:bg-[color-mix(in_oklab,var(--color-primary-core)_6%,white)] data-[state=open]:shadow-[0_12px_32px_-16px_color-mix(in_oklab,var(--color-primary-core)_35%,transparent)]"
    >
      <Accordion.Header>
        <Accordion.Trigger className="flex w-full cursor-pointer items-start gap-4 rounded-[20px] p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-core)] focus-visible:ring-inset sm:p-[23px]">
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--color-surface-subtle)] text-lg leading-[1.5] font-semibold text-[var(--color-neutral-charcoal)] transition-colors duration-200 ease-out group-data-[state=open]/faq:bg-[var(--color-neutral-white)] group-data-[state=open]/faq:text-[var(--color-primary-core)] sm:size-14 sm:text-xl"
          >
            {String(n).padStart(2, "0")}
          </span>
          <span className="flex-1 self-center text-base leading-[1.45] font-semibold text-[var(--color-neutral-charcoal)] sm:text-xl">
            {faq.question}
          </span>
          {/* Plus turns 45° into a close mark when open. */}
          <HugeiconsIcon
            icon={Add01Icon}
            aria-hidden
            strokeWidth={2}
            className="mt-0.5 size-6 shrink-0 text-[var(--color-primary-core)] transition-transform duration-200 ease-out group-data-[state=open]/faq:rotate-45 motion-reduce:transition-none"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden motion-reduce:animate-none">
        {/* Figma (border included): question/answer at x=96, 16px between them, 24px bottom. */}
        <p className="pr-4 pb-5 pl-4 text-sm leading-6 text-[var(--color-text-secondary)] sm:-mt-[7px] sm:pr-[64px] sm:pb-[23px] sm:pl-[95px] sm:text-base">
          {faq.answer}
        </p>
      </Accordion.Content>
    </Accordion.Item>
  );
}
