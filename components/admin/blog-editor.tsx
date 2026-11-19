"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  focusRing,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import {
  AdminPage,
  Field,
  QueryState,
  Section,
  StatusPill,
  inputClass,
  textareaClass,
} from "@/components/admin/admin-ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FilePicker } from "@/components/files/file-picker";
import { BlogMarkdown } from "@/components/blog/blog-markdown";
import {
  BLOG_FIELDS,
  BLOG_STATUS_META,
  EXCERPT_MAX,
  blogFormFrom,
  emptyBlogForm,
  slugify,
  toBlogPatch,
  toCreateBlogPost,
  useAdminBlogPost,
  useCreateBlogPost,
  useDeleteBlogPost,
  useUpdateBlogPost,
  validateBlogForm,
  type AdminBlogPost,
  type BlogField,
  type BlogForm,
  type UpdateBlogPostBody,
} from "@/lib/admin-blog";
import { errorCodeMessage, mapServerIssuesToFields } from "@/lib/api-errors";
import {
  FILE_RULES,
  useRefreshExpiredMedia,
  type FileAsset,
} from "@/lib/files";
import { ApiError } from "@/lib/profile";
import { toastError } from "@/lib/toast";

/** The editor page for a new post (no id) or an existing one. */
export function BlogEditorPage({ id }: { id?: string }) {
  const query = useAdminBlogPost(id ?? "");

  if (!id) {
    return (
      <AdminPage
        back={{ href: "/dashboard/admin/blog", label: "Blog" }}
        title="New post"
        description="Save a draft to keep working on it, or publish it now."
      >
        <BlogEditor />
      </AdminPage>
    );
  }

  const post = query.data;
  return (
    <AdminPage
      back={{ href: "/dashboard/admin/blog", label: "Blog" }}
      title={post ? post.title : "Edit post"}
      description={
        post && (
          <StatusPill tone={BLOG_STATUS_META[post.status].tone}>
            {BLOG_STATUS_META[post.status].label}
          </StatusPill>
        )
      }
    >
      <QueryState
        query={query}
        isEmpty={!post}
        loadingLabel="Loading post"
        errorText="Couldn't load this post."
        emptyText="This post could not be found."
        skeletonCount={2}
      >
        {post && <BlogEditor key={post.id} post={post} />}
      </QueryState>
    </AdminPage>
  );
}

type Action = "save" | "publish" | "unpublish" | "archive";

const STATUS_FOR_ACTION: Partial<
  Record<Action, "PUBLISHED" | "DRAFT" | "ARCHIVED">
> = {
  publish: "PUBLISHED",
  unpublish: "DRAFT",
  archive: "ARCHIVED",
};

/**
 * The form for a new post (no `post`) or an existing one. Errors show after the first press.
 * PATCH sends only the fields that changed from the last saved version.
 */
function BlogEditor({ post }: { post?: AdminBlogPost }) {
  const refreshExpired = useRefreshExpiredMedia();
  const router = useRouter();
  const isNew = !post;
  const [saved, setSaved] = useState<AdminBlogPost | null>(post ?? null);
  const baseline = saved ? blogFormFrom(saved) : emptyBlogForm();
  const [form, setForm] = useState<BlogForm>(baseline);
  // A new post's slug follows its title until the admin edits the slug.
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [picked, setPicked] = useState<FileAsset | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<
    Partial<Record<BlogField, string>>
  >({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  const create = useCreateBlogPost();
  const update = useUpdateBlogPost(saved?.id ?? "");
  const remove = useDeleteBlogPost(saved?.id ?? "");
  const pending = create.isPending || update.isPending || remove.isPending;
  const busy = pending || coverBusy;

  const clientErrors = validateBlogForm(form);
  const errors: Partial<Record<BlogField, string>> = submitted
    ? { ...clientErrors }
    : {};
  for (const field of BLOG_FIELDS) {
    if (serverErrors[field]) errors[field] = serverErrors[field];
  }
  const hasClientErrors = Object.keys(clientErrors).length > 0;
  const patch: UpdateBlogPostBody = saved ? toBlogPatch(baseline, form) : {};
  const dirty = Object.keys(patch).length > 0;

  function setField<K extends keyof BlogForm>(field: K, value: BlogForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field in serverErrors) {
      setServerErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function setTitle(title: string) {
    setForm((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
    }));
    setServerErrors((prev) => ({ ...prev, title: undefined }));
  }

  function pickCover(asset: FileAsset | null) {
    setPicked(asset);
    setForm((prev) => ({ ...prev, coverFileId: asset?.id ?? null }));
  }

  /** Shows a 409 slug conflict on the slug field, a 400's issues on their fields, else a toast. */
  function onServerError(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.code === "BLOG_SLUG_EXISTS") {
      setServerErrors({ slug: errorCodeMessage(err) });
      return;
    }
    if (err instanceof ApiError && err.issues) {
      const fields = mapServerIssuesToFields<BlogField>(err.issues);
      const matched = BLOG_FIELDS.filter((f) => fields[f]);
      if (matched.length > 0) {
        const next: Partial<Record<BlogField, string>> = {};
        for (const field of matched) next[field] = fields[field];
        setServerErrors(next);
        return;
      }
    }
    toastError(fallback, err);
  }

  function onSaved(next: AdminBlogPost, message: string) {
    toast.success(message);
    setSaved(next);
    setForm(blogFormFrom(next));
    setPicked(null);
    setSubmitted(false);
  }

  function submitNew(status: "DRAFT" | "PUBLISHED") {
    setSubmitted(true);
    if (hasClientErrors) return;
    create.mutate(toCreateBlogPost(form, status), {
      onSuccess: (created) => {
        toast.success(status === "DRAFT" ? "Draft saved" : "Post published");
        router.replace(
          `/dashboard/admin/blog/${encodeURIComponent(created.id)}`,
        );
      },
      onError: (err) =>
        onServerError(
          err,
          status === "DRAFT"
            ? "Couldn't save the draft."
            : "Couldn't publish the post.",
        ),
    });
  }

  function submitEdit(action: Action) {
    setSubmitted(true);
    if (hasClientErrors || !saved) return;
    const status = STATUS_FOR_ACTION[action];
    const body: UpdateBlogPostBody = {
      ...patch,
      ...(status ? { status } : {}),
    };
    const messages: Record<Action, string> = {
      save: "Changes saved",
      publish: "Post published",
      unpublish: "Post unpublished",
      archive: "Post archived",
    };
    const fallbacks: Record<Action, string> = {
      save: "Couldn't save your changes.",
      publish: "Couldn't publish the post.",
      unpublish: "Couldn't unpublish the post.",
      archive: "Couldn't archive the post.",
    };
    update.mutate(body, {
      onSuccess: (next) => onSaved(next, messages[action]),
      onError: (err) => onServerError(err, fallbacks[action]),
    });
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isNew) submitNew("DRAFT");
    else if (dirty) submitEdit("save");
  }

  const currentCover =
    saved?.cover?.url && form.coverFileId === saved.cover.fileId
      ? saved.cover.url
      : null;

  return (
    <form noValidate onSubmit={onFormSubmit} className="flex flex-col gap-4">
      <Section title="Post">
        <Field label="Title" hint="3 to 160 characters." error={errors.title}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              value={form.title}
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={inputClass}
            />
          )}
        </Field>

        <Field
          label="Link slug"
          hint={`Shown at /blog/${form.slug.trim() || "your-slug"}. Lowercase letters, digits and hyphens.`}
          error={errors.slug}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setField("slug", e.target.value);
              }}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(inputClass, "font-mono text-sm")}
            />
          )}
        </Field>

        <Field
          label="Excerpt"
          hint={`Optional. ${form.excerpt.trim().length} of ${EXCERPT_MAX} characters, shown on the blog list.`}
          error={errors.excerpt}
        >
          {({ id, describedBy, invalid }) => (
            <textarea
              id={id}
              value={form.excerpt}
              onChange={(e) => setField("excerpt", e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={cn(textareaClass, "min-h-20")}
            />
          )}
        </Field>

        <Field
          label="Body"
          hint="Markdown. Use ## for headings, - for lists, [text](url) for links and > for quotes."
          error={errors.body}
        >
          {({ id, describedBy, invalid }) => (
            <div className="grid gap-2">
              <div
                role="group"
                aria-label="Body view"
                className="inline-flex w-fit rounded-full bg-[var(--color-neutral-off-white)] p-1"
              >
                {(["Write", "Preview"] as const).map((label) => {
                  const active = preview === (label === "Preview");
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPreview(label === "Preview")}
                      className={cn(
                        "min-h-9 rounded-full px-4 text-sm font-semibold transition-[background-color,color] duration-150 ease-out motion-reduce:transition-none",
                        focusRing,
                        active
                          ? "bg-[var(--color-neutral-white)] text-[var(--color-neutral-charcoal)] shadow-[0_0_0_1px_rgb(0_0_0/0.08)]"
                          : "text-[var(--color-text-secondary)]",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {/* The textarea stays mounted in Preview so its label and error still apply. */}
              <textarea
                id={id}
                value={form.body}
                onChange={(e) => setField("body", e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                hidden={preview}
                spellCheck
                className={cn(
                  textareaClass,
                  "min-h-72 font-mono text-sm leading-relaxed",
                )}
              />
              <div
                hidden={!preview}
                aria-label="Body preview"
                className="min-h-72 rounded-[12px] border border-[var(--color-border-control)] bg-[var(--color-neutral-white)] p-4"
              >
                {form.body.trim() ? (
                  <BlogMarkdown source={form.body} />
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Nothing to preview yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </Field>
      </Section>

      <Section title="Cover image">
        {currentCover && (
          <div className="flex flex-wrap items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- R2 URLs are not configured for next/image. */}
            <img
              src={currentCover}
              onError={refreshExpired}
              alt=""
              loading="lazy"
              className="aspect-[16/9] w-full max-w-sm rounded-[16px] object-cover outline outline-1 -outline-offset-1 outline-black/10"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPicked(null);
                setField("coverFileId", null);
              }}
              className={cn(ghostButton, "min-h-10 px-3")}
            >
              Remove cover
            </button>
          </div>
        )}
        <Field
          label={currentCover ? "Replace cover" : "Cover image"}
          hint={`Optional. ${FILE_RULES.BLOG_COVER.hint}.`}
        >
          {({ id, describedBy, invalid }) => (
            <FilePicker
              id={id}
              describedBy={describedBy}
              invalid={invalid}
              purpose="BLOG_COVER"
              value={picked}
              onChange={pickCover}
              onBusyChange={setCoverBusy}
              disabled={pending}
              chooseLabel="Choose a cover image"
            />
          )}
        </Field>
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {saved?.status === "DRAFT" && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={busy}
            className={cn(
              ghostButton,
              "me-auto min-h-11 text-[var(--color-semantic-error-text)]",
            )}
          >
            Delete draft
          </button>
        )}

        {isNew ? (
          <>
            <button
              type="button"
              onClick={() => submitNew("DRAFT")}
              disabled={busy}
              aria-busy={create.isPending || undefined}
              className={cn(secondaryButton, "min-h-11")}
            >
              {create.isPending ? "Saving..." : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => submitNew("PUBLISHED")}
              disabled={busy}
              aria-busy={create.isPending || undefined}
              className={cn(primaryButton, "min-h-11")}
            >
              Publish
            </button>
          </>
        ) : (
          <>
            {saved?.status !== "ARCHIVED" && (
              <button
                type="button"
                onClick={() => submitEdit("archive")}
                disabled={busy}
                className={cn(secondaryButton, "min-h-11")}
              >
                Archive
              </button>
            )}
            {saved?.status === "PUBLISHED" ? (
              <button
                type="button"
                onClick={() => submitEdit("unpublish")}
                disabled={busy}
                className={cn(secondaryButton, "min-h-11")}
              >
                Unpublish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => submitEdit("publish")}
                disabled={busy}
                className={cn(secondaryButton, "min-h-11")}
              >
                Publish
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !dirty}
              aria-busy={update.isPending || undefined}
              className={cn(primaryButton, "min-h-11")}
            >
              {update.isPending ? "Saving..." : "Save"}
            </button>
          </>
        )}
      </div>

      {saved && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            if (!remove.isPending) setDeleteOpen(open);
          }}
          title="Delete this draft?"
          actions={[
            {
              label: "Keep draft",
              variant: "secondary",
              onSelect: () => setDeleteOpen(false),
            },
            {
              label: remove.isPending ? "Deleting..." : "Delete draft",
              variant: "primary",
              onSelect: () =>
                remove.mutate(undefined, {
                  onSuccess: () => {
                    toast.success("Draft deleted");
                    router.push("/dashboard/admin/blog");
                  },
                  onError: (err) => {
                    setDeleteOpen(false);
                    toastError("Couldn't delete the draft.", err);
                  },
                }),
            },
          ]}
        >
          The draft and its cover image are removed. This can&apos;t be undone.
        </ConfirmDialog>
      )}
    </form>
  );
}
