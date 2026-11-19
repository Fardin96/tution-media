"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { card, focusRing, primaryButton } from "@/components/profile/styles";
import {
  AdminPage,
  FilterChips,
  LoadMore,
  QueryState,
  StatusPill,
} from "@/components/admin/admin-ui";
import {
  BLOG_STATUS_META,
  useAdminBlogPosts,
  type AdminBlogPost,
  type BlogStatus,
} from "@/lib/admin-blog";
import { formatDateTime } from "@/lib/admin";

type View = "ALL" | BlogStatus;

const VIEWS: { value: View; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];

const EMPTY_TEXT: Record<View, string> = {
  ALL: "No posts yet.",
  DRAFT: "No drafts.",
  PUBLISHED: "No published posts.",
  ARCHIVED: "No archived posts.",
};

export function AdminBlogPage() {
  const [view, setView] = useState<View>("ALL");
  const query = useAdminBlogPosts(view === "ALL" ? {} : { status: view });
  const posts = query.data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Blog"
      description="Write posts for the public blog. Drafts stay hidden until you publish them."
      actions={
        <Link
          href="/dashboard/admin/blog/new"
          className={cn(primaryButton, "min-h-11")}
        >
          New post
        </Link>
      }
    >
      <FilterChips
        label="Post status"
        value={view}
        options={VIEWS}
        onChange={setView}
      />

      <QueryState
        query={query}
        isEmpty={posts.length === 0}
        loadingLabel="Loading posts"
        errorText="Couldn't load posts."
        emptyText={EMPTY_TEXT[view]}
      >
        <ul className="grid gap-4">
          {posts.map((post) => (
            <li key={post.id}>
              <PostRow post={post} />
            </li>
          ))}
        </ul>
        <LoadMore query={query} />
      </QueryState>
    </AdminPage>
  );
}

function PostRow({ post }: { post: AdminBlogPost }) {
  const meta = BLOG_STATUS_META[post.status];
  return (
    <Link
      href={`/dashboard/admin/blog/${encodeURIComponent(post.id)}`}
      className={cn(card, "grid gap-3 p-5", focusRing)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 font-semibold break-words text-[var(--color-neutral-charcoal)]">
          {post.title}
        </p>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>
      <p className="font-mono text-xs break-all text-[var(--color-text-secondary)]">
        /blog/{post.slug}
      </p>
      <p className="text-xs break-words text-[var(--color-text-secondary)] tabular-nums">
        Updated {formatDateTime(post.updatedAt)} ·{" "}
        {post.publishedAt
          ? `Published ${formatDateTime(post.publishedAt)}`
          : "Not published"}
      </p>
    </Link>
  );
}
