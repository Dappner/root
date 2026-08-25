import { defineConfig } from "orval";

export default defineConfig({
  ragApi: {
    input: {
      target: "../fast-api/openapi.json",
    },
    output: {
      target: "./src/features/rag/rag-api.generated.ts",
      client: "fetch",
      mode: "single",
      baseUrl: "",
      override: {
        mutator: {
          path: "./src/lib/fetchers/api-fetcher.ts",
          name: "customFetch",
        },
      },
    },
  },
});
