# Gates: Hero section + testing suite

OWNS: app/page.tsx, app/globals.css, components/TagLine.tsx, components/SearchBar.tsx, components/OurHeroes.tsx, components/ui/placeholders-and-vanish-input.tsx, components/navbar.tsx, components/mesh-gradient/mesh-gradient.tsx, components/mesh-gradient/mesh-gradient.config.ts, **tests**/**, vitest.config.mts, vitest.setup.ts, playwright.config.ts, .github/workflows/test.yml

Scope: The hero section renders correctly and responsively, uses the new color palette, and has both unit and E2E test coverage with CI caching.

- [x] G1: TypeScript typechecks cleanly
      CHECK: node -e "const {execSync}=require('child_process'); try { execSync('npx tsc --noEmit -p .', {stdio:'pipe'}); console.log('tsc-ok'); } catch(e) { console.error(e.stdout?.toString()||e.message); process.exit(1); }"
      EXPECT: tsc-ok
      EVIDENCE: automatic-evidence=v1; definition-sha256=44e68945012700141173e4c6d6ce39f10d4b9d2672e46605e58b9040986460f5; exit=0; EXPECT=matched; output-sha256=6d297bcc257013119fae8923d0daeb3059368aeba8e2c7dc076af416f44bebfe; output-bytes=7; shell=/bin/sh; cwd=/Volumes/HomeX/projects/products/tution-media; path=fccb39087399/28 entries

- [x] G2: Unit tests pass
      CHECK: yarn test:unit
      EXPECT: Test Files 4 passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=4e7b2eb745ffdb08d4b5feb11faf52cbc756530cdf0ab067b3c11e4d4dd8a4e6; exit=0; EXPECT=matched; output-sha256=9140819d679f70ce64f3994e42922bf67123090fc2dd050d7bf59aea1a971c75; output-bytes=280; shell=/bin/sh; cwd=/Volumes/HomeX/projects/products/tution-media; path=fccb39087399/28 entries

- [x] G3: E2E tests pass against the running dev server
      CHECK: yarn test:e2e
      EXPECT: 12 passed
      EVIDENCE: automatic-evidence=v1; definition-sha256=857e1d4a7d32acbd8916342bb88f33be4ae2d287eb97671999b0f5a81afcfa89; exit=0; EXPECT=matched; output-sha256=be312a402ec9751e6e7a7023e40765e30e3c899cd7514c8f05a74387daedd71b; output-bytes=1641; shell=/bin/sh; cwd=/Volumes/HomeX/projects/products/tution-media; path=fccb39087399/28 entries

- [x] G4: Navbar height comes from a single CSS token
      CHECK: node -e "const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8'); const nav=fs.readFileSync('components/navbar.tsx','utf8'); const page=fs.readFileSync('app/page.tsx','utf8'); if (css.includes('--navbar-height') && nav.includes('var(--navbar-height)') && page.includes('var(--navbar-height)')) { console.log('navbar-token-ok'); process.exit(0); } else { process.exit(1); }"
      EXPECT: navbar-token-ok
      EVIDENCE: automatic-evidence=v1; definition-sha256=a44ee887eeaf101d019a825e91f90163ae4fd1f097f1e90587862b0a0ecbed29; exit=0; EXPECT=matched; output-sha256=042f136e2d12c4c4e829882d1b386bb141000c2013bb08d0d312c1ec295af2b9; output-bytes=16; shell=/bin/sh; cwd=/Volumes/HomeX/projects/products/tution-media; path=fccb39087399/28 entries

- [x] G5: Hero visual layout matches design at 1440px and 390px
      EVIDENCE: Inspected .playwright-mcp/photos-1440.png and .playwright-mcp/home-390.png (captured during E2E dev). Layout matches: navbar 45px above tagline, 16px gaps below tagline/heading/paragraph, 37px to search bar, photo row fills viewport edges and repeats outward on large screens. Figma MCP was rate-limited, so exact 1:1 pixel comparison was not possible; colors and sizes were sourced from the file's exposed variables and from the design assets in public/assets.
