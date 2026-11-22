import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getStoredTokens } from "./api";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";
import { refreshSiteContentForUser } from "./site-content.actions";
import { wordCount } from "./site-content-schema";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type Story = Schemas["Story"];
export type StoryList = Schemas["StoryList"];
export type CreateStoryInput = Schemas["CreateStoryInput"];
export type StoryRole = "STUDENT" | "TUTOR";
export type StoryStatus = Story["status"];
export type StoryBlockedReason = StoryList["blockedReason"];

/** Limits mirror tuition-api. Counted on trimmed text; words split on whitespace. */
export const STORY_LIMITS = {
  headlineChars: 85,
  studentBodyChars: 700,
  studentBodyWords: 90,
  tutorBodyChars: 300,
} as const;

export const storyApi = {
  list: () => unwrap(client.GET("/api/v1/me/stories")),
  create: (body: CreateStoryInput) =>
    unwrap(client.POST("/api/v1/me/stories", { body })),
  remove: (id: string) =>
    unwrap(
      client.DELETE("/api/v1/me/stories/{id}", {
        params: { path: { id } },
      }),
    ),
};

/** The signed-in student's or tutor's stories, with whether a new one can be sent. */
export function useMyStories(enabled = true) {
  return useQuery({
    queryKey: queryKeys.stories.mine,
    queryFn: storyApi.list,
    enabled,
  });
}

export function useCreateStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStoryInput) => storyApi.create(body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.stories.mine }),
  });
}

/**
 * A withdrawn story may be on the landing, so ask the server to expire the landing cache now.
 * Failure is ignored: the landing catches up within 30 minutes anyway.
 */
async function refreshLandingForUser() {
  const tokens = getStoredTokens();
  if (!tokens) return;
  try {
    await refreshSiteContentForUser(tokens.accessToken);
  } catch {
    // The landing refreshes within 30 minutes anyway.
  }
}

export function useDeleteStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storyApi.remove(id),
    onSuccess: () => {
      void refreshLandingForUser();
      return queryClient.invalidateQueries({
        queryKey: queryKeys.stories.mine,
      });
    },
  });
}

export interface StoryForm {
  headline: string;
  body: string;
  imageFileId: string | null;
  videoFileId: string | null;
  consent: boolean;
}

export type StoryFormErrors = Partial<Record<keyof StoryForm, string>>;

/** Client checks for the story form. The API checks the same limits and the consent. */
export function validateStoryForm(
  role: StoryRole,
  form: StoryForm,
): StoryFormErrors {
  const errors: StoryFormErrors = {};
  const body = form.body.trim();

  if (role === "STUDENT") {
    const headline = form.headline.trim();
    if (!headline) errors.headline = "Enter a headline.";
    else if (/[\r\n]/.test(form.headline))
      errors.headline = "Keep the headline to one line.";
    else if (headline.length > STORY_LIMITS.headlineChars)
      errors.headline = `Keep it to ${STORY_LIMITS.headlineChars} characters or fewer.`;
  }

  if (!body) errors.body = "Write your story.";
  else if (
    body.length >
    (role === "STUDENT"
      ? STORY_LIMITS.studentBodyChars
      : STORY_LIMITS.tutorBodyChars)
  )
    errors.body = `Keep it to ${
      role === "STUDENT"
        ? STORY_LIMITS.studentBodyChars
        : STORY_LIMITS.tutorBodyChars
    } characters or fewer.`;
  else if (
    role === "STUDENT" &&
    wordCount(body) > STORY_LIMITS.studentBodyWords
  )
    errors.body = `Keep it to ${STORY_LIMITS.studentBodyWords} words or fewer.`;

  if (!form.consent) errors.consent = "Tick the box to agree before sending.";
  return errors;
}

export const STORY_STATUS: Record<
  StoryStatus,
  { label: string; tone: "warning" | "success" | "error" }
> = {
  PENDING: { label: "Waiting for review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Not approved", tone: "error" },
};

/** The line explaining why a new story can't be sent, or null when one can. */
export function blockedText(
  reason: StoryBlockedReason | undefined,
  max: number,
): string | null {
  if (reason === "LIMIT")
    return `You have ${max} stories, the most allowed. Delete one to send another.`;
  if (reason === "PENDING")
    return "Your story is waiting for review. You can send another once it's reviewed.";
  return null;
}

/** The row title: the headline for students, the first line of the text for tutors. */
export function storyTitle(story: Pick<Story, "headline" | "body">): string {
  const headline = story.headline?.trim();
  if (headline) return headline;
  return story.body.trim().split(/\r?\n/)[0] ?? "";
}

export function formatStoryDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(new Date(iso));
}
