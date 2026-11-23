import { readFileSync } from "node:fs";
import path from "node:path";
import {
  test,
  expect,
  type BrowserContext,
  type Route,
} from "@playwright/test";
import type { components } from "@/lib/api-types";
import { mockApi, sessionCookie } from "./profile-mocks";

type Schemas = components["schemas"];

const PHOTO = path.join(__dirname, "fixtures", "avatar.png");
const FILE_ID = "5b3c9e1a-2d4f-4a6b-8c7d-9e0f1a2b3c4d";
const UPLOAD_HOST = "https://upload.example.test";
const AVATAR_URL = "https://pub-test.r2.dev/avatars/nadia.webp";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

/**
 * Upload routes for the profile photo flow. Registered after mockApi, so they win for these
 * paths and hand everything else back with route.fallback().
 */
async function mockAvatarUpload(context: BrowserContext) {
  const saves: { method: string; path: string; body: unknown }[] = [];
  const json = (route: Route, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  const file = {
    id: FILE_ID,
    purpose: "AVATAR",
    contentType: "image/webp",
    sizeBytes: 4096,
    fileName: "photo.png",
    createdAt: "2026-11-23T04:00:00.000Z",
  } as const;

  await context.route("**/api/v1/files/upload-status", (route) =>
    json(route, {
      blocksVideos: false,
      blocksDocuments: false,
      note: null,
      blockedAt: null,
    } satisfies Schemas["UploadStatus"]),
  );
  await context.route("**/api/v1/files/upload-url", (route) =>
    json(route, {
      file: { ...file, status: "PENDING_UPLOAD", uploadedAt: null },
      uploadUrl: `${UPLOAD_HOST}/${FILE_ID}`,
      method: "PUT",
      headers: { "Content-Type": "image/webp" },
      expiresAt: "2026-11-23T04:05:00.000Z",
    } satisfies Schemas["UploadUrl"]),
  );
  await context.route(`**/api/v1/files/${FILE_ID}/complete`, (route) =>
    json(route, {
      ...file,
      status: "UPLOADED",
      uploadedAt: "2026-11-23T04:00:05.000Z",
    } satisfies Schemas["FileAsset"]),
  );
  await context.route("**/api/v1/me/avatar", async (route) => {
    const req = route.request();
    if (req.method() !== "PUT") return route.fallback();
    saves.push({
      method: "PUT",
      path: "/me/avatar",
      body: req.postDataJSON(),
    });
    return json(route, {
      avatarUrl: AVATAR_URL,
    } satisfies Schemas["Avatar"]);
  });
  // The browser PUTs the bytes straight to the signed storage URL, after a CORS preflight.
  await context.route(`${UPLOAD_HOST}/**`, (route) =>
    route.fulfill({
      status: route.request().method() === "OPTIONS" ? 204 : 200,
      headers: CORS,
      body: "",
    }),
  );
  // The saved photo is served from the public bucket; without this the hero's <img> fails and shows initials.
  await context.route("https://pub-test.r2.dev/**", (route) =>
    route.fulfill({ contentType: "image/png", body: readFileSync(PHOTO) }),
  );

  return saves;
}

test.describe("Profile picture", () => {
  test("uploads a photo, saves it, and shows it in the hero", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("STUDENT")]);
    await mockApi(context, "STUDENT", { onboarded: true });
    const saves = await mockAvatarUpload(context);
    await page.goto("/dashboard");

    await page.getByRole("button", { name: "Change profile picture" }).click();
    const dialog = page.getByRole("dialog", { name: "Profile picture" });
    await expect(
      dialog.getByText("Your photo shows to tutors on your applications."),
    ).toBeVisible();

    await dialog.getByLabel("New photo").setInputFiles(PHOTO);
    await expect(dialog.getByRole("status")).toHaveText(
      "Photo ready. Save to use it.",
    );
    await dialog.getByRole("button", { name: "Save photo" }).click();

    await expect(page.getByText("Profile picture updated")).toBeVisible();
    await expect(dialog).toBeHidden();
    // The hero's avatar is the <img> just before its camera badge.
    await expect(
      page
        .getByRole("button", { name: "Change profile picture" })
        .locator("xpath=preceding-sibling::img"),
    ).toHaveAttribute("src", AVATAR_URL);
    expect(saves).toEqual([
      { method: "PUT", path: "/me/avatar", body: { fileId: FILE_ID } },
    ]);
  });
});
