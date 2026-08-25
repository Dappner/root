export const sources = {
  createSource(title: string): Cypress.Chainable<JQuery<HTMLElement>> {
    cy.findByRole("button", { name: /add source/i }).click();
    cy.findByLabelText(/title/i).clear().type(title);
    cy.findByRole("button", { name: /create source/i }).click();

    return cy.findByText(title, { timeout: 10000 }).should("exist");
  },

  openSource(title: string): void {
    cy.findByText(title).first().click();
    cy.url().should("include", "/sources/");
  },

  updateSourceTitle(newTitle: string): Cypress.Chainable<JQuery<HTMLElement>> {
    cy.findByRole("button", { name: /edit source/i }).click();
    cy.findByLabelText(/title/i).clear().type(newTitle);
    cy.findByRole("button", { name: /save/i }).click();

    cy.findByText(/updated source/i, { timeout: 10000 }).should("be.visible");

    return cy.findByText(newTitle, { timeout: 10000 }).should("exist");
  },

  deleteSource(): void {
    cy.findByRole("button", { name: /delete source/i }).click();
    cy.findByRole("button", { name: /confirm|delete/i }).click();
    cy.url().should("eq", Cypress.config().baseUrl + "/sources");
  },

  archiveSource(): void {
    cy.findByRole("button", { name: /mark as done/i }).click();
    cy.wait(1000);
  },
};
