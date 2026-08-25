import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  globalIgnores([
    "dist/**",
    "build/**",
    "node_modules/**",
    "cypress/**",
    // Generated — never lint.
    "src/routeTree.gen.ts",
    "src/features/rag/rag-api.generated.ts",
  ]),

  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // Enforce the type-facade pattern — only feature facades may import the
  // orval-generated FastAPI client directly. (Mirrors the prior config.)
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "**/types.ts",
      "**/api.ts",
      "src/features/rag/rag-api.types.ts",
      "src/features/podcasts/transcript-api.ts",
      // Direct mutation-function consumers without a facade indirection.
      "src/features/player/global-audio-element.tsx",
      "src/features/sources/hooks/citations.ts",
      "src/features/sources/hooks/use-media-playback-position.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/rag/rag-api.generated"],
              message:
                "Import from a feature types.ts / api.ts facade instead of @/features/rag/rag-api.generated directly. This keeps coupling to orval centralized.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
