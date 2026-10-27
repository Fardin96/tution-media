# Tuition Media — Next.js 16 + React 19

## Quickstart

| Command             | Action                                      |
| ------------------- | ------------------------------------------- |
| `yarn dev`          | Start dev server at http://localhost:3000   |
| `yarn build`        | Production build (output to `.next/`)       |
| `yarn start`        | Serve production build                      |
| `yarn lint`         | Run ESLint                                  |
| `yarn typecheck`    | Run `next typegen && tsc --noEmit`          |
| `yarn format:check` | Check Prettier formatting                   |
| `yarn test:unit`    | Run vitest unit tests (`__tests__/unit/`)   |
| `yarn test:e2e`     | Run playwright e2e tests (`__tests__/e2e/`) |
| `yarn test`         | Run unit + e2e                              |

## Key conventions

- **Auth**: P = public, S = student, T = tutor, A = admin, SA = super admin. See `endpoints.md` for the 120-tracked schema v5 endpoints.
- **Markdown**: `endpoints.md` is gitignored — keep it updated but do not commit.
- **Tables**: All endpoint tables use `# | Method | Path | Who | deferred | Purpose` format. The `deferred` column uses `[ ]` / `[x]` checkboxes in VS Code preview.
- **Branch/PR**: Default branch is `main`. Feature branches off `main`. PRs require at least one maintainer approval and all CI to pass.
- **Env**: Variables in `.env.local` are for local dev only. Do not commit `.env*` files.
- **Tailwind**: Config in `postcss.config.mjs`. Use `cn()` utility (from `@/lib/utils` or `class-variance-authority`) for class merging.
- **Notifications**: Show action outcomes (saved, deleted, failed) with `toast` from `sonner`. `<Toaster />` (`components/ui/sonner.tsx`) is mounted once in `app/layout.tsx`. Field validation stays inline next to its field. Do not use `alert()` or inline status banners for outcomes.

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
- **No manual migrations** — data seeding lives in `lib/` (e.g., `places.ts`, `features.ts`).

## Gotchas

- **`endpoints.md`** is gitignored but tracked locally. Updated via the `deferred` checkbox column (click `[ ]` → `[x]` in VS Code preview). Do not commit unless the gitignore changes.
- **Next.js 16 breaking changes**: APIs, conventions, and file structure may differ from older Next.js versions. Always read `node_modules/next/dist/docs/` for the resolved version.
- **Typegen + tsc**: `yarn typecheck` runs both `next typegen` and `tsc --noEmit` in that order. Run `lint -> typecheck -> test` sequentially.
- **Husky pre-commit**: Runs `yarn lint-staged` which does `eslint --fix && prettier --write`. Commit will fail if lint/format issues are auto-fixable.
- **Tailwind CSS v4**: Config moved to `postcss.config.mjs`. Do not edit `tailwind.config.*` if it exists — it may not be used.

## Useful scripts (package.json)

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "next typegen && tsc --noEmit",
  "format:check": "prettier --check .",
  "prepare": "husky",
  "test:unit": "vitest run",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test": "yarn test:unit && yarn test:e2e"
}
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
