"use client";

import type { ComponentType } from "react";
import {
  errorAt,
  LinkInputs,
  ListEditor,
  TextArea,
  TextInput,
  type LinkValue,
} from "@/components/admin/site-content/fields";
import {
  FaqEditor,
  FooterEditor,
  HowItWorksEditor,
  ShowcaseEditor,
  TestimonialsEditor,
} from "@/components/admin/site-content/list-editors";
import type { BlockValue, SiteContentKey } from "@/lib/site-content-schema";

// One editor per block. Each gets the block's draft, a change handler and the validation
// errors for the whole block; errors are looked up by dot path with errorAt.

export interface EditorProps<T> {
  value: T;
  onChange(next: T): void;
  errors: Record<string, string>;
}

/** The editor for one block key; `value` is that block's shape. */
export type Editor<K extends SiteContentKey = SiteContentKey> = ComponentType<
  EditorProps<BlockValue<K>>
>;

/* ───────── Hero ───────── */

function PlaceholderList({
  label,
  items,
  errors,
  path,
  onChange,
}: {
  label: string;
  items: string[];
  errors: Record<string, string>;
  path: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <ListEditor<string>
      label={label}
      items={items}
      onChange={onChange}
      min={1}
      max={8}
      singular="placeholder"
      newItem={() => ""}
      itemLabel={(item) => item.trim() || "Empty"}
      renderItem={(item, i, update) => (
        <TextInput
          label="Placeholder text"
          value={item}
          max={40}
          error={errorAt(errors, `${path}.${i}`)}
          onChange={update}
        />
      )}
      errors={errors}
      path={path}
    />
  );
}

export function HeroEditor({
  value,
  onChange,
  errors,
}: EditorProps<BlockValue<"hero">>) {
  return (
    <div className="grid gap-6">
      <TextInput
        label="Tagline"
        value={value.tagline}
        max={60}
        hint="The chip above the headline."
        error={errorAt(errors, "tagline")}
        onChange={(tagline) => onChange({ ...value, tagline })}
      />
      <TextInput
        label="Headline"
        value={value.headline}
        max={80}
        error={errorAt(errors, "headline")}
        onChange={(headline) => onChange({ ...value, headline })}
      />
      <TextArea
        label="Subline"
        value={value.subline}
        max={200}
        rows={3}
        error={errorAt(errors, "subline")}
        onChange={(subline) => onChange({ ...value, subline })}
      />
      <PlaceholderList
        label="Subject placeholders"
        items={value.skillPlaceholders}
        errors={errors}
        path="skillPlaceholders"
        onChange={(skillPlaceholders) =>
          onChange({ ...value, skillPlaceholders })
        }
      />
      <PlaceholderList
        label="Place placeholders"
        items={value.placePlaceholders}
        errors={errors}
        path="placePlaceholders"
        onChange={(placePlaceholders) =>
          onChange({ ...value, placePlaceholders })
        }
      />
      <TextInput
        label="Search button"
        value={value.searchLabel}
        max={20}
        error={errorAt(errors, "searchLabel")}
        onChange={(searchLabel) => onChange({ ...value, searchLabel })}
      />
    </div>
  );
}

/* ───────── Navigation bar ───────── */

const EMPTY_LINK: LinkValue = { label: "", href: "" };

export function NavEditor({
  value,
  onChange,
  errors,
}: EditorProps<BlockValue<"nav">>) {
  return (
    <div className="grid gap-6">
      <ListEditor<LinkValue>
        label="Menu links"
        items={value.links}
        onChange={(links) => onChange({ ...value, links })}
        min={1}
        max={7}
        singular="link"
        newItem={() => ({ ...EMPTY_LINK })}
        itemLabel={(link) => link.label.trim() || "New link"}
        renderItem={(link, i, update) => (
          <LinkInputs
            label="Menu link"
            textLabel="Link text"
            value={link}
            onChange={update}
            errors={errors}
            path={`links.${i}`}
          />
        )}
        errors={errors}
        path="links"
      />
      <LinkInputs
        label="Register Now button"
        value={value.cta}
        onChange={(cta) => onChange({ ...value, cta })}
        errors={errors}
        path="cta"
      />
    </div>
  );
}

/* ───────── Categories ───────── */

export function CategoriesEditor({
  value,
  onChange,
  errors,
}: EditorProps<BlockValue<"categories">>) {
  return (
    <div className="grid gap-6">
      <TextInput
        label="Title"
        value={value.title}
        max={80}
        error={errorAt(errors, "title")}
        onChange={(title) => onChange({ ...value, title })}
      />
      <TextArea
        label="Description"
        value={value.description}
        max={200}
        rows={3}
        error={errorAt(errors, "description")}
        onChange={(description) => onChange({ ...value, description })}
      />
      <LinkInputs
        label="Button"
        value={value.cta}
        onChange={(cta) => onChange({ ...value, cta })}
        errors={errors}
        path="cta"
      />
    </div>
  );
}

/* ───────── Call to action banner ───────── */

export function CtaBannerEditor({
  value,
  onChange,
  errors,
}: EditorProps<BlockValue<"cta_banner">>) {
  return (
    <div className="grid gap-6">
      <TextInput
        label="Heading"
        value={value.heading}
        max={120}
        error={errorAt(errors, "heading")}
        onChange={(heading) => onChange({ ...value, heading })}
      />
      <TextArea
        label="Text"
        value={value.text}
        max={300}
        rows={3}
        error={errorAt(errors, "text")}
        onChange={(text) => onChange({ ...value, text })}
      />
      <LinkInputs
        label="Button"
        value={value.cta}
        onChange={(cta) => onChange({ ...value, cta })}
        errors={errors}
        path="cta"
      />
    </div>
  );
}

/* ───────── Search and sharing ───────── */

/** How the title and description read in a search result. Shown as the editor's preview. */
export function SearchSnippet({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-w-0 gap-1 rounded-[16px] bg-[var(--color-neutral-white)] p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.06)]">
      <p className="text-xs text-[var(--color-text-secondary)]">Masters Hub</p>
      <p className="line-clamp-2 text-lg break-words text-[var(--color-primary-core)]">
        {title || "Untitled"}
      </p>
      <p className="line-clamp-3 text-sm break-words text-[var(--color-text-secondary)]">
        {description}
      </p>
    </div>
  );
}

export function SeoEditor({
  value,
  onChange,
  errors,
}: EditorProps<BlockValue<"seo">>) {
  return (
    <div className="grid gap-6">
      <TextInput
        label="Page title"
        value={value.title}
        max={70}
        hint="Shown in search results and in the browser tab."
        error={errorAt(errors, "title")}
        onChange={(title) => onChange({ ...value, title })}
      />
      <TextArea
        label="Description"
        value={value.description}
        max={200}
        rows={3}
        error={errorAt(errors, "description")}
        onChange={(description) => onChange({ ...value, description })}
      />
    </div>
  );
}

/* ───────── Static pages ───────── */

export function PageEditor({
  value,
  onChange,
  errors,
}: EditorProps<BlockValue<"about_page">>) {
  return (
    <div className="grid gap-6">
      <TextInput
        label="Title"
        value={value.title}
        max={80}
        error={errorAt(errors, "title")}
        onChange={(title) => onChange({ ...value, title })}
      />
      <TextArea
        label="Description"
        value={value.description}
        max={200}
        rows={3}
        error={errorAt(errors, "description")}
        onChange={(description) => onChange({ ...value, description })}
      />
      <TextArea
        label="Body"
        value={value.body}
        max={20_000}
        rows={18}
        hint="Markdown: headings with ##, lists with -, links with [text](https://…). Raw HTML is not shown."
        error={errorAt(errors, "body")}
        onChange={(body) => onChange({ ...value, body })}
      />
    </div>
  );
}

/* ───────── Registry ───────── */

/**
 * Editors for the blocks that have one. A block without an entry shows "Editor coming next" in
 * the page, and its preview still renders.
 */
export const EDITORS: Partial<{ [K in SiteContentKey]: Editor<K> }> = {
  hero: HeroEditor,
  nav: NavEditor,
  categories: CategoriesEditor,
  testimonials: TestimonialsEditor,
  showcase: ShowcaseEditor,
  how_it_works: HowItWorksEditor,
  faq: FaqEditor,
  cta_banner: CtaBannerEditor,
  footer: FooterEditor,
  seo: SeoEditor,
  about_page: PageEditor,
  terms_page: PageEditor,
  privacy_page: PageEditor,
  contact_page: PageEditor,
};

/**
 * The same registry, typed loosely for the page, which holds each draft as unknown. The cast is
 * the one place where a block key meets its editor's props.
 */
export const EDITOR_COMPONENTS = EDITORS as unknown as Partial<
  Record<SiteContentKey, ComponentType<EditorProps<unknown>>>
>;
