"use client";

import { Accordion } from "radix-ui";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { SectionHeader } from "@/components/section-header";
import { ArrowLinkButton } from "@/components/arrow-link-button";

type Faq = { id: string; question: string; answer: string };

// ponytail: placeholder copy. Split into the two Figma columns; on phones they stack 01→05.
const columns: Faq[][] = [
  [
    {
      id: "faq-1",
      question: "How do I create an account as a guardian or student?",
      answer:
        "Tap Register Now, choose Guardian or Student, and sign up with your phone number or email. Add your area, class and the subjects you need, and we will start showing matching tutors right away. It takes about two minutes and is completely free.",
    },
    {
      id: "faq-2",
      question: "How do I find and hire the right tutor?",
      answer:
        "Search by subject and location, then filter by class, budget and rating. Open a profile to see qualifications, reviews and teaching videos. When you find a good fit, send a request; most tutors reply within a day and many offer a free trial class.",
    },
    {
      id: "faq-3",
      question: "How can I track my child's progress?",
      answer:
        "After each session the tutor logs what was covered and any homework. You get a short progress report every two weeks, and you can message the tutor anytime from your dashboard if you want to discuss weak areas or upcoming exams.",
    },
  ],
  [
    {
      id: "faq-4",
      question: "How are tutors on Masters Hub verified?",
      answer:
        "Every tutor submits a national ID and proof of their latest qualification, which our team checks by hand before the profile goes live. We also review ratings from guardians and students, and tutors who fall below our standards are removed from search.",
    },
    {
      id: "faq-5",
      question:
        "Is there a cost to use Masters Hub, and what features are free?",
      answer:
        "Searching, comparing profiles, reading reviews and messaging tutors are all free. You only pay the tutor's fee once you start classes, and packages show the full price upfront. There are no hidden charges or subscription fees.",
    },
  ],
];

const numbered = columns.flat().map((f, i) => [f.id, i + 1] as const);
const numberOf = Object.fromEntries(numbered);

export function Faq() {
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
          title="Frequently asked Questions"
        />

        {/* One root so only one answer is open at a time; 04 starts open as in Figma.
            Each column is its own stack, so opening an item only pushes its own column. */}
        <Accordion.Root
          type="single"
          collapsible
          defaultValue="faq-4"
          className="mt-8 grid items-start gap-4 lg:mt-[35px] lg:grid-cols-2 lg:gap-[30px]"
        >
          {columns.map((col, c) => (
            <div key={c} className="flex flex-col gap-4 lg:gap-[30px]">
              {col.map((f) => (
                <FaqItem key={f.id} faq={f} n={numberOf[f.id]} />
              ))}
            </div>
          ))}
        </Accordion.Root>

        <ArrowLinkButton variant="solid" className="mt-10 self-center">
          View All
        </ArrowLinkButton>
      </div>
    </section>
  );
}

function FaqItem({ faq, n }: { faq: Faq; n: number }) {
  return (
    <Accordion.Item
      value={faq.id}
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
