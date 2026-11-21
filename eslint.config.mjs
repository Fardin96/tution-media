import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party UI components are vendored; lint them later.
    "components/ui/**",
    // Generated from tuition-api's openapi.json by `yarn gen:api`.
    "lib/api-types.ts",
    // Copied from tuition-api by `yarn gen:site-defaults`.
    "lib/site-content-schema.ts",
  ]),
]);

export default eslintConfig;
