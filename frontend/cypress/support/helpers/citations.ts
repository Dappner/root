export const citations = {
  addCitation(text: string): Cypress.Chainable<JQuery<HTMLElement>> {
    cy.findByRole("button", { name: /quote/i }).click();
    cy.findByLabelText(/text/i).type(text);
    cy.findByRole("button", { name: /create citation/i }).click();

    return cy
      .findByText(/citation created successfully/i, { timeout: 10000 })
      .should("be.visible");
  },

  verifyCitationExists(text: string): Cypress.Chainable<JQuery<HTMLElement>> {
    cy.findByRole("tab", { name: /sections\s*&\s*highlights/i }).click();
    return cy.findByText(text, { timeout: 10000 }).should("exist");
  },

  moveCitationToSection(
    citationText: string,
    sectionName: string
  ): Cypress.Chainable<JQuery<HTMLElement>> {
    cy.findByRole("tab", { name: /sections\s*&\s*highlights/i }).click();

    cy.contains("p", citationText)
      .parent()
      .parent()
      .within(() => {
        cy.findByRole("button", { name: /move to section/i }).click();
      });

    cy.findByRole("dialog", { name: /move to section/i }).within(() => {
      cy.findByRole("button", { name: /section/i }).click();
      cy.findByRole("option", { name: sectionName }).click();
      cy.findByRole("button", { name: /move/i }).click();
    });

    return cy
      .findByText(/highlight moved successfully/i, { timeout: 10000 })
      .should("be.visible");
  },
};
