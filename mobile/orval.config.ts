import { defineConfig } from "orval";

export default defineConfig({
  ragApi: {
    input: {
      target: "../fast-api/openapi.json",
    },
    output: {
      target: "./lib/api/rag-generated.ts",
      client: "fetch",
      mode: "single",
      baseUrl: "",
      override: {
        mutator: {
          path: "./lib/api/fetcher.ts",
          name: "mobileFetch",
        },
      },
    },
  },
});
