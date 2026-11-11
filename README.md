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

## Location & address

- Addresses are picked with Google Places autocomplete, restricted to Bangladesh (`includedRegionCodes: ["bd"]`). `app/api/places/details` returns `422 "Pick a location in Bangladesh."` for any other country; the picker shows that message as a toast.
- The district comes from the `administrative_area_level_2` component of the place. When Google has none, the picker asks for it manually ("District").
- Profile saves send `address` plus an optional `location: { lat, lng, addressText, district, placeId }`. `location` is only sent when a Places address, its district and coordinates are all present.
- The backend returns `location: { lat, lng, addressText, districtCode, placeId, needsReaddress } | null` on `GET /api/v1/me`, and the form reads it back from there.
- We only operate in Dhaka right now. Any other district shows a non-blocking warning; the profile can still be saved.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
