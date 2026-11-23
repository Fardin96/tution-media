This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — HTTP-referrer restricted, Maps JavaScript API only. Used by `@vis.gl/react-google-maps` on the tutor zones page. Without it the page shows a fallback and stays usable through place search.
- `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` — Optional map ID; falls back to DEMO_MAP_ID.
- The server-only `GOOGLE_MAPS_API_KEY` powers `/api/places/*` and must never be exposed to the browser.

## Location & address

- Addresses are picked with Google Places autocomplete, restricted to Bangladesh (`includedRegionCodes: ["bd"]`). `app/api/places/details` returns `422 "Pick a location in Bangladesh."` for any other country; the picker shows that message as a toast.
- `POST /api/places/reverse` turns a map pin into an address (`formattedAddress`, `placeId`, `district`). It needs a signed-in session (401 otherwise), returns 400 for a bad or out-of-box point, 422 when there is no address or the point is outside Bangladesh, and 502 when Google fails. The Geocoding API must be enabled on `GOOGLE_MAPS_API_KEY`.
- The district comes from the `administrative_area_level_2` component of the place. When Google has none, the picker asks for it manually ("District"). When a district is known, the picker shows it read-only under the address ("District: …").
- Profile saves send `address` plus an optional `location: { lat, lng, addressText, district, placeId }`. `location` is sent when a district and coordinates are present, plus a placeId for a picked suggestion. A map pin is sent without `placeId` (the API keeps it as a PIN location, which never expires); a pin without a district can't be saved.
- The backend returns `location: { lat, lng, addressText, districtCode, placeId, needsReaddress } | null` on `GET /api/v1/me`, and the form reads it back from there.
- We only operate in Dhaka right now. Any other district shows a non-blocking warning; the profile can still be saved.

## Generated API types

The frontend uses typed API clients generated from the backend's OpenAPI document.

- Run `yarn gen:api` to generate `lib/api-types.ts` from `../tuition-api/openapi.json`.
- Run `yarn gen:api:check` to verify the file is up to date (runs in CI).
- Set `OPENAPI_SPEC` (path or URL) to use a different source.
- Uses openapi-typescript with `defaultNonNullable: false`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
