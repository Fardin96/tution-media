# Tuition Media — Next.js 16 + React 19

## Quickstart

| Command              | Action                                                         |
| -------------------- | -------------------------------------------------------------- |
| `yarn dev`           | Start dev server at http://localhost:3000                      |
| `yarn build`         | Production build (output to `.next/`)                          |
| `yarn start`         | Serve production build                                         |
| `yarn lint`          | Run ESLint                                                     |
| `yarn typecheck`     | Run `next typegen && tsc --noEmit`                             |
| `yarn format:check`  | Check Prettier formatting                                      |
| `yarn gen:api`       | Generate `lib/api-types.ts` from `../tuition-api/openapi.json` |
| `yarn gen:api:check` | Fail when `lib/api-types.ts` is stale                          |
| `yarn test:unit`     | Run vitest unit tests (`__tests__/unit/`)                      |
| `yarn test:e2e`      | Run playwright e2e tests (`__tests__/e2e/`)                    |
| `yarn test`          | Run unit + e2e                                                 |

## Key conventions

- **Auth**: P = public, S = student, T = tutor, A = admin, SA = super admin. See `endpoints.md` for the 143 tracked schema v6 endpoints.
- **Admin area**: `app/dashboard/admin/layout.tsx` guards ADMIN/SUPER_ADMIN sessions and renders `components/admin/admin-shell.tsx` (sidebar on lg+, scrolling tab row on mobile, approval gate for PENDING/REMOVED admins). `useAdminMe()` in `lib/admin.ts` reads GET /me for adminRole/status (the session cookie only says ADMIN) and exposes isSuperAdmin; it also has formatDateTime and formatAmount. `/dashboard` redirects admins to `/dashboard/admin` (overview: `components/admin/admin-overview.tsx`). Shared kit `components/admin/admin-ui.tsx`: AdminPage, StatusPill, FilterChips, QueryState, LoadMore, DetailList, Section, AdminDialog, DialogActions, Field. Pages and lib files: packages (+[id], lib/admin-packages.ts), zone-requests, applications (lib/admin-applications.ts; rows open /dashboard/applications/[id]?from=admin, which shows a read-only admin view with an "Open fee" link), fees (+[id], lib/admin-fees.ts), accounts (+[id], lib/admin-accounts.ts), team (lib/admin-team.ts), subjects (lib/admin-subjects.ts), settings (lib/admin-settings.ts), audit-log (lib/admin-audit.ts). Query keys `queryKeys.admin.*` (prefix ["admin"]). Super-admin-only buttons are hidden unless isSuperAdmin. List pages use BackLink "Admin"; detail pages go back to their list.
- **Markdown**: `endpoints.md` is gitignored — keep it updated but do not commit.
- **Applications and browse**: `lib/applications.ts` defines `applicationApi` (list, get, forRequirement, forPackage, apply, requestPackage, act), hooks `useMyApplications`, `useApplication`, `useRequirementApplicants`, `useApplicationAction`, `useApplyToRequirement`, `useRequestPackage`, `STATUS_META`, `ACTION_META`. `ALREADY_APPLIED` is treated as success (resolves null, still invalidates). `lib/browse.ts` holds browse filters in URL params, hooks `useBrowseRequirements`, `useBrowsePackages`, `usePackage`, `useTutorSearch`, `useNearbyTutors`, `formatDistanceKm`, and URL helpers `requirementFilters…`, `packageFilters…` and `tutorFilters…` (`FromSearchParams` / `ToSearchParams`). Query keys: `queryKeys.applications.*`, `queryKeys.browse.*`, and `invalidateApplications` (invalidates ["applications"], ["browse"], `queryKeys.me` and ["notifications"] on every mutation). Pages: `/dashboard/applications` (list with status filter), `/dashboard/applications/[id]` (detail; the student also sees the tutor's details and matching set from `tutorProfile`/`tutorSet` via `components/applications/tutor-details.tsx`), `/dashboard/requirements/[id]/applicants` (student sees applicants), `/dashboard/find-tuitions` (tutor browse requirements: Near me, All open, or My sets, which sends `scope=set&setId` and hides the four manual filters; URL `?scope=set&set=<id>`, default set preselected), `/dashboard/find-tutors` with `?tab=tutors|packages` and `/dashboard/find-tutors/packages/[id]` (student browse packages/tutors). Student find-tutors packages empty state says "No packages found" with copy to browse tutors or post a requirement. Online payment is a disabled placeholder.
- **Tutor packages**: `lib/packages.ts` exports `packageApi` (mine, get, create, update, close), hooks `useMyPackages`, `useMyPackage` (shares browse detail key), `usePackageRequests` (infinite), `useCreatePackage`, `useUpdatePackage`, `useClosePackage`, `usePackageReadiness` (shares queryKeys.me), `packageMissing` (drops default_requirement), `packageState`, and shared formatters COVERAGE_LABEL, durationLabel, priceLabel, packageLevelText, packagePlaceText. `useTeachingOptions` and `queryKeys.tutor.teachingOptions` are gone. Every package write calls `invalidatePackages` (invalidates `queryKeys.packages.mine` plus everything `invalidateApplications` covers). Pages (tutor only): `/dashboard/tutor/packages` (list: live first then Closed group; cards have View requests, Edit and Close for OPEN packages; Close asks for confirmation), `/dashboard/tutor/packages/new` and `/dashboard/tutor/packages/[id]/edit` (`components/packages/package-form.tsx`: groups About this package (title, what it covers, coverage, duration in weeks), Subjects (SetSubjectPicker), Classes you teach (EducationRangePicker), When (times, DaysOfWeekField, DaysPerWeekField, available from), Students and price (max students, total package price), Where ("I also teach online" + ZonePicker with emptyHint prop). The edit page reads initial data from useMyPackages (GET /packages/:id has no zoneIds)), `/dashboard/tutor/packages/[id]/requests` (`components/packages/package-requests-page.tsx`: student requests with Accept/Decline through existing application actions; cards link to `/dashboard/applications/[id]?from=package-requests&package=<id>`, detail page's BackLink goes to requests page labelled "Requests"). Tutor dashboard: the static sample packages section and the "Your packages" link card are gone; `components/packages/dashboard-section.tsx` TutorPackagesSection ("Your tuition packages", up to 2 open packages, New package, See all packages) replaces them. Never seed or fake data. `packageState` shows "In review" (PENDING) and "Changes needed" (REJECTED, admin note shown on the card); create toast "Package sent for review"; editing a rejected package says "Package sent for review again".
- **Education levels**: Labels come from `GET /api/v1/lookups/education` through `useEducationLookup()` in `lib/education.ts`, and are never hardcoded. `EducationLevelPicker` (`components/requirements/education-level-picker.tsx`) is the only picker. Level 0 and negative levels are valid, so check `levelCode === null`, never truthiness.
- **Subjects**: subjects come from GET /api/v1/subjects via `lib/subjects.ts` (`useSubjects`, `loadSubjects`, `clearSubjectCache`); the static SUBJECTS list in lib/profile.ts is gone; `searchSubjects` keeps its signature; `subjectNames(ids, subjects)` and `targetRows(..., subjects)` take the list; unit tests mock `@/lib/subjects`; e2e mocks serve /subjects (`subjectsMock` in **tests**/e2e/profile-mocks.ts).
- **Tables**: All endpoint tables use `# | Method | Path | Who | deferred | Purpose` format. The `deferred` column uses `[ ]` / `[x]` checkboxes in VS Code preview.
- **Branch/PR**: Default branch is `main`. Feature branches off `main`. PRs require at least one maintainer approval and all CI to pass.
- **Env**: Variables in `.env.local` are for local dev only. Do not commit `.env*` files.
- **Tailwind**: Config in `postcss.config.mjs`. Use `cn()` utility (from `@/lib/utils` or `class-variance-authority`) for class merging.
- **Notifications (toasts)**: Show action outcomes (saved, deleted, failed) with `toast` from `sonner`. `<Toaster />` (`components/ui/sonner.tsx`) is mounted once in `app/layout.tsx`. Field validation stays inline next to its field. Do not use `alert()` or inline status banners for outcomes.
- **Notification bell**: in-app alerts only (toasts above are for action outcomes). `lib/notifications.ts` has `notificationApi` (list, unreadCount, read, readAll), `useUnreadCount` (polls every 60 s and on focus), `useNotifications(enabled)` (fetched only while open), `useMarkRead`, `useMarkAllRead` and `notificationText` (copy per kind). Keys `queryKeys.notifications.*`, `invalidateNotifications`. `NotificationBell` (`components/notifications/notification-bell.tsx`, radix Popover) is mounted in the dashboard `TopBar` and in `PageFrame`. `notificationText` covers PACKAGE_UPDATED ("<name> updated a package you requested.") and PACKAGE_CLOSED ("<name> closed a package you requested.").
- **Set subject picker**: `components/tutor-requirements/set-subject-picker.tsx` is a token combobox: selected subjects are removable tokens in the field, typing searches `searchSubjects`, and unselected profile subjects show below as "From your profile" buttons. Subjects outside the profile are added to it on save (`newProfileSubjects`).
- **Package form**: `lib/package-form.ts` exports `emptyPackageForm`, `fromMyPackage`, `validatePackageForm`, `toCreatePackagePayload`, `toPackagePatch` (only changed fields; arrays compared as sets; syncProfileSubjects when new subjects). `components/packages/package-form.tsx`: groups About this package (title, what it covers, coverage, duration in weeks), Subjects (SetSubjectPicker), Classes you teach (EducationRangePicker), When (times, DaysOfWeekField, DaysPerWeekField, available from), Students and price (max students, total package price), Where ("I also teach online" + ZonePicker with emptyHint prop). The edit page reads initial data from useMyPackages (GET /packages/:id has no zoneIds).
- **Tutor requirement sets**: live in `lib/tutor-requirements.ts` and `components/tutor-requirements/`, and use TanStack Query keys from `lib/query-keys.ts`. Every set mutation calls `invalidateTutorRequirements`. Profile-subject removal goes through `lib/subject-removal.ts` and the `SaveCancelled` error in `components/profile/edit-section.tsx`.
- **Readiness checklist**: `components/profile/readiness-checklist.tsx` ReadinessChecklist lists each missing profile item with an instruction and a link to where it is fixed; shown above the package form on create (publish disabled) and after a 403 PROFILE_INCOMPLETE. The verification card on /dashboard has id="verification".
- **Listing card**: `components/ui/listing-card.tsx` ListingCard (icon tile, status pill, title, body, details, footer meta + figure, actions; accentAt(index) rotates tile colours) — used by tutor package cards (my-package-card.tsx), requirement set cards (tutor-requirement-card.tsx), and zone list items (zone-list.tsx). The student browse PackageCard keeps its own design.
- **Days**: `lib/days.ts` holds DAYS (bit0 = Saturday), EVERY_DAY, countDays, daysLabel, daysPerWeekLabel and daysPerWeekError. `components/requirements/day-fields.tsx` has DaysOfWeekField (weekday chips) and DaysPerWeekField (1-7 segmented radios). Both the student post form and the tutor set form use them. Student requirements send `availableDays` and `daysPerWeek`. Tutor sets send `daysPerWeek`: the form requires a value, while the API allows null (any number of the chosen days). The count must not exceed the chosen days. `lib/tutor-requirements.ts` re-exports DAYS and daysLabel and adds `daysSummary(set)`.
- **Back navigation**: every dashboard page except `/dashboard` shows exactly one `BackLink` (`components/ui/back-link.tsx`). It is blue (ghostButton) and sits at the leading edge as the first item of the content column. Its label is the destination's name ("Dashboard", "Applications", "Applicants", "Packages", "Requests", "Requirement sets") with no "Back to" prefix. Do not add a second back button in empty or error states. `RequirementPageShell` takes `back` and `eyebrow` props. `/dashboard/applications/[id]?from=applicants` sends the student back to that requirement's applicants list. `/dashboard/applications/[id]?from=package-requests&package=<id>` sends the tutor back to the package's requests page labelled "Requests".
- **Logout**: `LogoutButton` opens a `ConfirmDialog` ("Log out?"). Cancel is first and gets focus. Tokens are revoked only after the user confirms.
- **Tutor zones**: live in `lib/tutor-zones.ts` and `components/tutor-zones/` (map with a "Drop pin" toggle under it: while on, one click or tap on the map places the zone centre, saved circles stop taking clicks, Esc turns it off, and Add zone turns it on automatically; the pin stays draggable; list, editor with place search, radius slider and a "Pinned at lat, lng" line for map-placed pins, delete confirmation listing affected sets and warning when a default in-person set loses its only zone, zone-limit request dialog with history). TanStack Query keys: `queryKeys.tutor.zones`, `queryKeys.tutor.zoneRequests`, `queryKeys.admin.zoneRequests(filters)` (prefix `['admin','zone-requests']`). Every zone write calls `invalidateTutorZones` (invalidates zones + requirement sets + me + match). ZonePicker (`components/tutor-requirements/zone-picker.tsx`) sends zoneIds in requirement-set form; set cards show zone counts; tutor dashboard has a Teaching zones card. Zone delete dialog also lists affected open packages and warns when one is left with no zone and not online. `lib/tutor-zones.ts` has `zoneUsageText(zone)`.
- **Tutor dashboard**: the static sample packages section and the "Your packages" link card are gone; `components/packages/dashboard-section.tsx` TutorPackagesSection ("Your tuition packages", up to 2 open packages, New package, See all packages) replaces them.
- **Student package views**: Student package card/detail and application views show the package title, total price ("৳X total") and duration.
- **Endpoint count**: 143 (added GET /admin/subjects and GET /admin/packages/:id).
- **Maps**: `@vis.gl/react-google-maps` 1.10.2. Browser env vars: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (HTTP-referrer restricted, Maps JavaScript API only) and `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (falls back to DEMO_MAP_ID). Without the key the page shows a fallback and stays usable through place search. The existing server-only `GOOGLE_MAPS_API_KEY` still powers `/api/places/*` and must never be exposed.
- **API client and types**: `yarn gen:api` generates `lib/api-types.ts` (committed, never hand-edited, ESLint-ignored) from `../tuition-api/openapi.json` or `OPENAPI_SPEC` (path or URL); `yarn gen:api:check` fails when stale. CI job `api-types` clones tuition-api at the same-named branch (fallback main) and runs the check. Uses openapi-typescript with `defaultNonNullable: false`. All backend calls use `client` + `unwrap` from `lib/api-client.ts` (openapi-fetch routed through `apiFetch`, so bearer token + 401 refresh still work); `unwrap` throws the same `ApiError` as `parseJson`. Domain types are aliases of `Schemas["..."]`. `ERROR_CODES`/`MESSAGES` in `lib/api-errors.ts` are checked against the generated `ErrorCode` so a new backend code without a message fails typecheck. e2e mocks in `__tests__/e2e/profile-mocks.ts` use `satisfies Schemas[...]`. The new codes INVALID_ADMIN_STATE, INVALID_ACCOUNT_STATE, INVALID_FEE_STATE show the server's message.

## Directory ownership

| Directory          | Owner / Purpose                                      |
| ------------------ | ---------------------------------------------------- |
| `app/`             | Next.js app router — pages, routes, layout.tsx       |
| `components/`      | Reusable UI — shadcn primitives, tutor cards, forms  |
| `lib/`             | Logic & APIs — `api.ts`, auth helpers, feature flags |
| `app/(dashboard)/` | Protected tutor/student area                         |
| `app/api/`         | Route handlers (API endpoints)                       |
| `__tests__/unit/`  | Vitest unit tests                                    |
| `__tests__/e2e/`   | Playwright e2e tests                                 |

## Testing quirks

- **Unit tests**: `environment: "jsdom"`, globals enabled, setup at `vitest.setup.ts`. Include pattern: `__tests__/unit/**/*.{test,spec}.{ts,tsx}`.
- **E2E tests**: Requires dev server running. `baseURL: http://localhost:3000`. Trace: `on-first-retry`. CI doubles retry count (`retries: 2`).
- **Playwright web server**: CI uses `yarn build && yarn start`; local uses `yarn dev`. Server reused between tests when possible.
- **Fixtures**: No fixture files. Tests use inline data or mock APIs.

## Codegen / migrations

- **Type gen**: `next typegen` generates TypeScript types from `next.config.ts` and route handlers. Run as part of `typecheck`.
- **API types**: see "API client and types" above. After a backend change: `yarn openapi:export` in tuition-api, then `yarn gen:api` here, fix type errors, commit both.
- **No manual migrations** — data seeding lives in `lib/` (e.g., `places.ts`, `features.ts`).

## Gotchas

- **`endpoints.md`** is gitignored but tracked locally. Updated via the `deferred` checkbox column (click `[ ]` → `[x]` in VS Code preview). Do not commit unless the gitignore changes.
- **Next.js 16 breaking changes**: APIs, conventions, and file structure may differ from older Next.js versions. Always read `node_modules/next/dist/docs/` for the resolved version.
- **Typegen + tsc**: `yarn typecheck` runs both `next typegen` and `tsc --noEmit` in that order. Run `lint -> typecheck -> test` sequentially.
- **Husky pre-commit**: Runs `yarn lint-staged` which does `eslint --fix && prettier --write`. Commit will fail if lint/format issues are auto-fixable.
- **Tailwind CSS v4**: Config moved to `postcss.config.mjs`. Do not edit `tailwind.config.*` if it exists — it may not be used.
- **Unit test mocking**: Unit tests that need the network mock `apiFetch` with `vi.mock("@/lib/api", async (orig) => ({ ...(await orig()), apiFetch: vi.fn() }))`; a full `@/lib/api` mock must spread the original because `api-client` reads `API_URL`.
- **Node version**: Local Node must match `.nvmrc` (24) in the frontend. CI uses Node 24.

## Useful scripts (package.json)

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "next typegen && tsc --noEmit",
  "format:check": "prettier --check .",
  "gen:api": "node scripts/gen-api.mjs",
  "gen:api:check": "node scripts/gen-api.mjs --check",
  "prepare": "husky",
  "test:unit": "vitest run",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test": "yarn test:unit && yarn test:e2e"
}
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
