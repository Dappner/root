import "./commands";
import "@testing-library/cypress/add-commands";

Cypress.on("uncaught:exception", () => {
  // Prevent failing tests from 3rd-party script errors during E2E runs.
  return false;
});
