import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    screenshotsFolder: "cypress/screenshots",
  },
  env: {
    TEST_EMAIL: process.env.CYPRESS_TEST_EMAIL,
    TEST_PASSWORD: process.env.CYPRESS_TEST_PASSWORD,
  },
});
