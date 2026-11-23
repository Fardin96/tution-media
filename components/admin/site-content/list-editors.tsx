"use client";

import { useId, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ghostButton, secondaryButton } from "@/components/profile/styles";
import { FieldError } from "@/components/profile/profile-fields";
import { Field, inputClass } from "@/components/admin/admin-ui";
import { ToggleSwitch } from "@/components/admin/matching-ui";
import type { EditorProps } from "@/components/admin/site-content/editors";
import {
  SourceNote,
  SourcePicker,
} from "@/components/admin/site-content/source-picker";
import {
  errorAt,
  LinkInputs,
  ListEditor,
  MediaField,
  RadioGroup,
  SectionToggle,
  TextArea,
  TextInput,
  type LinkValue,
} from "@/components/admin/site-content/fields";
import {
  adjustOpenIndex,
  cardFromSource,
  sourceKey,
  VIDEO_OPTIONS,
} from "@/lib/admin-site-content";
import { SOCIAL_META, STEP_ICON_META } from "@/lib/site-content";
import {
  SOCIAL_PLATFORMS,
  STEP_ICONS,
  type BlockValue,
  type CardSource,
} from "@/lib/site-content-schema";

// Editors for the blocks that repeat: testimonials, showcase cards, the two step flows, the FAQ
// and the footer. Each card's fields are read by dot path from the block's errors.

type Testimonial = BlockValue<"testimonials">["items"][number];
type ShowcaseItem = BlockValue<"showcase">["items"][number];
type ShowcaseKind = ShowcaseItem["kind"];
type Flow = BlockValue<"how_it_works">["find"];
type Step = Flow["steps"][number];
type StepIcon = Step["icon"];
type FaqItem = BlockValue<"faq">["items"][number];
type FooterColumn = BlockValue<"footer">["columns"][number];
type SocialRow = BlockValue<"footer">["socials"][number];
type SocialPlatform = SocialRow["platform"];

const NEW_TESTIMONIAL: Testimonial = {
  name: "",
  role: "",
  photo: "",
  quote: "",
  comment: "",
};
const TESTIMONIAL_MAX = 12;

/** A testimonial without its video. The key goes, since an empty video would fail the schema. */
function withoutVideo(item: Testimonial): Testimonial {
  const next = { ...item };
  delete next.video;
  return next;
}

/** The submissions already in a list, so the picker can show them as added. */
export function addedSources(items: { source?: CardSource }[]): Set<string> {
  return new Set(
    items.flatMap((item) => (item.source ? [sourceKey(item.source)] : [])),
  );
}

/* ───────── Testimonials ───────── */

export function TestimonialsEditor({
  value,
  onChange,
  errors,
}: EditorProps<BlockValue<"testimonials">>) {
  return (
    <div className="grid gap-6">
      <SectionToggle
        value={value.enabled}
        onChange={(enabled) => onChange({ ...value, enabled })}
      />
      <TextInput
        label="Title"
        value={value.title}
        max={80}
        error={errorAt(errors, "title")}
        onChange={(title) => onChange({ ...value, title })}
      />
      <ListEditor<Testimonial>
        label="Testimonials"
        items={value.items}
        onChange={(items) => onChange({ ...value, items })}
        min={1}
        max={TESTIMONIAL_MAX}
        singular="testimonial"
        newItem={() => ({ ...NEW_TESTIMONIAL })}
        itemLabel={(item) => item.name.trim() || "New testimonial"}
        renderItem={(item, i, update) => (
          <>
            {item.source && (
              <SourceNote
                name={item.name}
                error={errorAt(errors, `items.${i}.source`)}
              />
            )}
            <TextInput
              label="Name"
              value={item.name}
              max={60}
              error={errorAt(errors, `items.${i}.name`)}
              onChange={(name) => update({ ...item, name })}
            />
            <TextInput
              label="Role"
              value={item.role}
              max={80}
              error={errorAt(errors, `items.${i}.role`)}
              onChange={(role) => update({ ...item, role })}
            />
            <MediaField
              slot="testimonialPhoto"
              label="Photo"
              value={item.photo}
              error={errorAt(errors, `items.${i}.photo`)}
              onChange={(photo) => update({ ...item, photo })}
            />
            {item.video === undefined ? (
              <div className="grid min-w-0 justify-items-start gap-2">
                <button
                  type="button"
                  onClick={() =>
                    update({ ...item, video: VIDEO_OPTIONS[0].value })
                  }
                  className={secondaryButton}
                >
                  Add video
                </button>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Optional. A short clip plays in place of the photo.
                </p>
              </div>
            ) : (
              <>
                <MediaField
                  slot="testimonialVideo"
                  label="Video"
                  value={item.video}
                  error={errorAt(errors, `items.${i}.video`)}
                  onChange={(video) => update({ ...item, video })}
                />
                <div className="grid justify-items-start">
                  <button
                    type="button"
                    onClick={() => update(withoutVideo(item))}
                    className={ghostButton}
                  >
                    Remove video
                  </button>
                </div>
              </>
            )}
            <TextInput
              label="Quote"
              value={item.quote}
              max={85}
              hint="Shown on the front of the card"
              error={errorAt(errors, `items.${i}.quote`)}
              onChange={(quote) => update({ ...item, quote })}
            />
            <TextArea
              label="Comment"
              value={item.comment}
              max={700}
              maxWords={90}
              rows={5}
              hint="Shown when the card is flipped"
              error={errorAt(errors, `items.${i}.comment`)}
              onChange={(comment) => update({ ...item, comment })}
            />
          </>
        )}
        errors={errors}
        path="items"
        extras={(append) => (
          <SourcePicker
            list="testimonials"
            full={value.items.length >= TESTIMONIAL_MAX}
            added={addedSources(value.items)}
            onAdd={(source) => append(cardFromSource("testimonials", source))}
          />
        )}
      />
    </div>
  );
}

/* ───────── Tutor showcase ───────── */

const CARD_TYPES: readonly { value: ShowcaseKind; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "comment", label: "Comment" },
];

/**
 * Turns a card into the other type. The name, subject and thumbnail carry over; the fields of
 * the new type start empty (a video starts on the first video in the list).
 */
function switchCardType(item: ShowcaseItem, kind: ShowcaseKind): ShowcaseItem {
  if (item.kind === kind) return item;
  const shared = {
    name: item.name,
    subject: item.subject,
    thumbnail: item.thumbnail,
  };
  return kind === "video"
    ? { kind, ...shared, video: VIDEO_OPTIONS[0].value }
    : { kind, ...shared, university: "", comment: "" };
}

function CardTypeRadios({
  value,
  onChange,
}: {
  value: ShowcaseKind;
  onChange: (kind: ShowcaseKind) => void;
}) {
  return (
    <RadioGroup
      legend="Card type"
      options={CARD_TYPES}
      value={value}
      onChange={onChange}
    />
  );
}

const SHOWCASE_MAX = 16;

const NEW_SHOWCASE: ShowcaseItem = {
  kind: "video",
  name: "",
  subject: "",
  thumbnail: "",
  video: VIDEO_OPTIONS[0].value,
};

export function ShowcaseEditor({
  value,
  onChange,
  errors,
}: EditorProps<BlockValue<"showcase">>) {
  return (
    <div className="grid gap-6">
      <SectionToggle
        value={value.enabled}
        onChange={(enabled) => onChange({ ...value, enabled })}
      />
      <TextInput
        label="Title"
        value={value.title}
        max={80}
        error={errorAt(errors, "title")}
        onChange={(title) => onChange({ ...value, title })}
      />
      <ListEditor<ShowcaseItem>
        label="Cards"
        items={value.items}
        onChange={(items) => onChange({ ...value, items })}
        min={1}
        max={SHOWCASE_MAX}
        singular="card"
        newItem={() => ({ ...NEW_SHOWCASE })}
        itemLabel={(item) => item.name.trim() || "New card"}
        renderItem={(item, i, update) => (
          <>
            {item.source && (
              <SourceNote
                name={item.name}
                error={errorAt(errors, `items.${i}.source`)}
              />
            )}
            <CardTypeRadios
              value={item.kind}
              onChange={(kind) => update(switchCardType(item, kind))}
            />
            <TextInput
              label="Name"
              value={item.name}
              max={60}
              error={errorAt(errors, `items.${i}.name`)}
              onChange={(name) => update({ ...item, name })}
            />
            <TextInput
              label="Subject"
              value={item.subject}
              max={60}
              error={errorAt(errors, `items.${i}.subject`)}
              onChange={(subject) => update({ ...item, subject })}
            />
            <MediaField
              slot="showcasePoster"
              label="Poster image"
              value={item.thumbnail}
              error={errorAt(errors, `items.${i}.thumbnail`)}
              onChange={(thumbnail) => update({ ...item, thumbnail })}
            />
            {item.kind === "video" ? (
              <MediaField
                slot="showcaseVideo"
                label="Video"
                value={item.video}
                error={errorAt(errors, `items.${i}.video`)}
                onChange={(video) => update({ ...item, video })}
              />
            ) : (
              <>
                <TextInput
                  label="University"
                  value={item.university}
                  max={100}
                  error={errorAt(errors, `items.${i}.university`)}
                  onChange={(university) => update({ ...item, university })}
                />
                <TextArea
                  label="Comment"
                  value={item.comment}
                  max={300}
                  rows={4}
                  error={errorAt(errors, `items.${i}.comment`)}
                  onChange={(comment) => update({ ...item, comment })}
                />
              </>
            )}
          </>
        )}
        errors={errors}
        path="items"
        extras={(append) => (
          <SourcePicker
            list="showcase"
            full={value.items.length >= SHOWCASE_MAX}
            added={addedSources(value.items)}
            onAdd={(source) => append(cardFromSource("showcase", source))}
          />
        )}
      />
    </div>
  );
}

/* ───────── How it works ───────── */

const NEW_STEP: Step = { title: "", description: "", icon: "signup" };

/** The icon as a native select, with its chip beside it. */
function StepIconField({
  value,
  error,
  onChange,
}: {
  value: StepIcon;
  error?: string;
  onChange: (icon: StepIcon) => void;
}) {
  const meta = STEP_ICON_META[value];
  return (
    <Field label="Icon" error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="flex min-w-0 items-center gap-3">
          <select
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value as StepIcon)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(inputClass, "min-w-0 flex-1")}
          >
            {STEP_ICONS.map((icon) => (
              <option key={icon} value={icon}>
                {STEP_ICON_META[icon].label}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full"
            style={{
              backgroundColor: `color-mix(in oklab, ${meta.hue} 10%, white)`,
            }}
          >
            <Image
              src={meta.icon}
              alt=""
              width={24}
              height={24}
              className="size-6 object-contain"
            />
          </span>
        </div>
      )}
    </Field>
  );
}

/** One of the two step flows. `path` is "find" or "become", so errors read "find.steps.0.title". */
function FlowGroup({
  path,
  fallback,
  flow,
  errors,
  onChange,
}: {
  path: "find" | "become";
  fallback: string;
  flow: Flow;
  errors: Record<string, string>;
  onChange: (next: Flow) => void;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-6">
      <h3
        id={headingId}
        className="text-base font-semibold text-[var(--color-neutral-charcoal)]"
      >
        {flow.label.trim() || fallback}
      </h3>
      <TextInput
        label="Tab label"
        value={flow.label}
        max={30}
        error={errorAt(errors, `${path}.label`)}
        onChange={(label) => onChange({ ...flow, label })}
      />
      <TextInput
        label="Video title"
        value={flow.video.title}
        max={60}
        error={errorAt(errors, `${path}.video.title`)}
        onChange={(title) =>
          onChange({ ...flow, video: { ...flow.video, title } })
        }
      />
      <TextInput
        label="Video subtitle"
        value={flow.video.subtitle}
        max={80}
        error={errorAt(errors, `${path}.video.subtitle`)}
        onChange={(subtitle) =>
          onChange({ ...flow, video: { ...flow.video, subtitle } })
        }
      />
      <MediaField
        slot="howItWorksPoster"
        label="Poster image"
        value={flow.video.thumbnail}
        error={errorAt(errors, `${path}.video.thumbnail`)}
        onChange={(thumbnail) =>
          onChange({ ...flow, video: { ...flow.video, thumbnail } })
        }
      />
      <MediaField
        slot="howItWorksVideo"
        label="Video"
        value={flow.video.video}
        error={errorAt(errors, `${path}.video.video`)}
        onChange={(video) =>
          onChange({ ...flow, video: { ...flow.video, video } })
        }
      />
      <ListEditor<Step>
        label="Steps"
        items={flow.steps}
        onChange={(steps) => onChange({ ...flow, steps })}
        min={1}
        max={6}
        singular="step"
        newItem={() => ({ ...NEW_STEP })}
        itemLabel={(step) => step.title.trim() || "New step"}
        renderItem={(step, i, update) => (
          <>
            <TextInput
              label="Step title"
              value={step.title}
              max={60}
              error={errorAt(errors, `${path}.steps.${i}.title`)}
              onChange={(title) => update({ ...step, title })}
            />
            <TextArea
              label="Step description"
              value={step.description}
              max={160}
              rows={3}
              error={errorAt(errors, `${path}.steps.${i}.description`)}
              onChange={(description) => update({ ...step, description })}
            />
            <StepIconField
              value={step.icon}
              error={errorAt(errors, `${path}.steps.${i}.icon`)}
              onChange={(icon) => update({ ...step, icon })}
            />
          </>
        )}
        errors={errors}
        path={`${path}.steps`}
      />
    </section>
  );
}

export function HowItWorksEditor({
  value,
  onChange,
  errors,
}: EditorProps<BlockValue<"how_it_works">>) {
  return (
    <div className="grid gap-12">
      <div className="grid gap-6">
        <SectionToggle
          value={value.enabled}
          onChange={(enabled) => onChange({ ...value, enabled })}
        />
        <TextInput
          label="Title"
          value={value.title}
          max={80}
          error={errorAt(errors, "title")}
          onChange={(title) => onChange({ ...value, title })}
        />
      </div>
      <FlowGroup
        path="find"
        fallback="Find a Tutor tab"
        flow={value.find}
        errors={errors}
        onChange={(find) => onChange({ ...value, find })}
      />
      <FlowGroup
        path="become"
        fallback="Become a Tutor tab"
        flow={value.become}
        errors={errors}
        onChange={(become) => onChange({ ...value, become })}
      />
    </div>
  );
}

/* ───────── FAQ ───────── */

const NEW_QUESTION: FaqItem = { question: "", answer: "" };

export function FaqEditor({
  value,
  onChange,
  errors,
}: EditorProps<BlockValue<"faq">>) {
  // The list calls onMove or onRemove just before its onChange. They store the open index here,
  // and that same onChange writes it with the items, so the two never disagree.
  const pendingOpen = useRef<number | null | undefined>(undefined);

  return (
    <div className="grid gap-6">
      <SectionToggle
        value={value.enabled}
        onChange={(enabled) => onChange({ ...value, enabled })}
      />
      <TextInput
        label="Title"
        value={value.title}
        max={80}
        error={errorAt(errors, "title")}
        onChange={(title) => onChange({ ...value, title })}
      />
      <ListEditor<FaqItem>
        label="Questions"
        items={value.items}
        onChange={(items) => {
          const openIndex =
            pendingOpen.current === undefined
              ? value.openIndex
              : pendingOpen.current;
          pendingOpen.current = undefined;
          onChange({ ...value, items, openIndex });
        }}
        min={1}
        max={20}
        singular="question"
        newItem={() => ({ ...NEW_QUESTION })}
        itemLabel={(item) => item.question.trim() || "New question"}
        renderItem={(item, i, update) => (
          <>
            <TextInput
              label="Question"
              value={item.question}
              max={160}
              error={errorAt(errors, `items.${i}.question`)}
              onChange={(question) => update({ ...item, question })}
            />
            <TextArea
              label="Answer"
              value={item.answer}
              max={800}
              rows={5}
              error={errorAt(errors, `items.${i}.answer`)}
              onChange={(answer) => update({ ...item, answer })}
            />
          </>
        )}
        errors={errors}
        path="items"
        onMove={(from, to) => {
          pendingOpen.current = adjustOpenIndex(value.openIndex, {
            type: "move",
            from,
            to,
          });
        }}
        onRemove={(index) => {
          pendingOpen.current = adjustOpenIndex(value.openIndex, {
            type: "remove",
            index,
          });
        }}
      />
      <Field label="Starts open" error={errorAt(errors, "openIndex")}>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            value={value.openIndex === null ? "" : String(value.openIndex)}
            onChange={(e) =>
              onChange({
                ...value,
                openIndex:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={inputClass}
          >
            <option value="">None</option>
            {value.items.map((item, i) => {
              const text = item.question.trim();
              return (
                <option key={i} value={String(i)}>
                  {text
                    ? `Question ${i + 1}: ${text.slice(0, 40)}`
                    : `Question ${i + 1}`}
                </option>
              );
            })}
          </select>
        )}
      </Field>
      <LinkInputs
        label="View All button"
        value={value.cta}
        onChange={(cta) => onChange({ ...value, cta })}
        errors={errors}
        path="cta"
      />
    </div>
  );
}

/* ───────── Footer ───────── */

const EMPTY_LINK: LinkValue = { label: "", href: "" };

export function FooterEditor({
  value,
  onChange,
  errors,
}: EditorProps<BlockValue<"footer">>) {
  const socialsId = useId();

  function setColumn(index: number, column: FooterColumn) {
    onChange({
      ...value,
      columns: value.columns.map((row, j) => (j === index ? column : row)),
    });
  }

  // Shown platforms only, kept in platform order. Checking one adds it with an empty link.
  function setShown(platform: SocialPlatform, on: boolean) {
    const others = value.socials.filter((row) => row.platform !== platform);
    const socials = on
      ? SOCIAL_PLATFORMS.flatMap((p) =>
          p === platform
            ? [{ platform: p, href: "" }]
            : value.socials.filter((row) => row.platform === p),
        )
      : others;
    onChange({ ...value, socials });
  }

  function setHref(index: number, href: string) {
    onChange({
      ...value,
      socials: value.socials.map((row, j) =>
        j === index ? { ...row, href } : row,
      ),
    });
  }

  return (
    <div className="grid gap-12">
      <div className="grid gap-6">
        <TextArea
          label="About"
          value={value.about}
          max={300}
          rows={4}
          error={errorAt(errors, "about")}
          onChange={(about) => onChange({ ...value, about })}
        />
        <TextArea
          label="Address"
          value={value.address}
          max={200}
          rows={2}
          error={errorAt(errors, "address")}
          onChange={(address) => onChange({ ...value, address })}
        />
        <TextInput
          label="Phone"
          value={value.phone}
          max={24}
          inputMode="tel"
          hint="Digits, spaces, + and - only"
          error={errorAt(errors, "phone")}
          onChange={(phone) => onChange({ ...value, phone })}
        />
        <TextInput
          label="Email"
          type="email"
          inputMode="email"
          value={value.email}
          max={120}
          error={errorAt(errors, "email")}
          onChange={(email) => onChange({ ...value, email })}
        />
        <TextInput
          label="Brand name"
          value={value.brandName}
          max={60}
          hint="Shown in the copyright line"
          error={errorAt(errors, "brandName")}
          onChange={(brandName) => onChange({ ...value, brandName })}
        />
      </div>

      <div className="grid gap-12">
        {value.columns.map((column, c) => (
          <section
            key={c}
            aria-label={column.heading.trim() || `Column ${c + 1}`}
            className="grid min-w-0 gap-6"
          >
            <h3 className="text-base font-semibold text-[var(--color-neutral-charcoal)]">
              {column.heading.trim() || `Column ${c + 1}`}
            </h3>
            <TextInput
              label={`Column ${c + 1} heading`}
              value={column.heading}
              max={40}
              error={errorAt(errors, `columns.${c}.heading`)}
              onChange={(heading) => setColumn(c, { ...column, heading })}
            />
            <ListEditor<LinkValue>
              label={`Column ${c + 1} links`}
              items={column.links}
              onChange={(links) => setColumn(c, { ...column, links })}
              min={1}
              max={8}
              singular="link"
              newItem={() => ({ ...EMPTY_LINK })}
              itemLabel={(link) => link.label.trim() || "New link"}
              renderItem={(link, i, update) => (
                <LinkInputs
                  label="Link"
                  textLabel="Link text"
                  value={link}
                  onChange={update}
                  errors={errors}
                  path={`columns.${c}.links.${i}`}
                />
              )}
              errors={errors}
              path={`columns.${c}.links`}
            />
          </section>
        ))}
      </div>

      <section aria-labelledby={socialsId} className="grid min-w-0 gap-6">
        <div className="grid gap-1">
          <h3
            id={socialsId}
            className="text-base font-semibold text-[var(--color-neutral-charcoal)]"
          >
            Social links
          </h3>
          <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
            Turn on a platform to show its icon in the footer. Each one needs a
            link.
          </p>
        </div>
        <FieldError
          id={`${socialsId}-error`}
          message={errorAt(errors, "socials")}
        />
        {SOCIAL_PLATFORMS.map((platform) => {
          const index = value.socials.findIndex(
            (row) => row.platform === platform,
          );
          const shown = index !== -1;
          const name = SOCIAL_META[platform].name;
          return (
            <div key={platform} className="grid min-w-0 gap-3">
              <ToggleSwitch
                label={`Show ${name}`}
                on={shown}
                onChange={(on) => setShown(platform, on)}
              />
              <TextInput
                label={`${name} link`}
                value={shown ? value.socials[index].href : ""}
                max={300}
                disabled={!shown}
                hint="Use a link starting with https://"
                error={
                  shown ? errorAt(errors, `socials.${index}.href`) : undefined
                }
                onChange={(href) => setHref(index, href)}
              />
            </div>
          );
        })}
      </section>
    </div>
  );
}
