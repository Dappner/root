type Direction = "up" | "down";

export const sections = {
  addSection(sectionName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    cy.findByRole("tab", { name: /sections\s*&\s*highlights/i }).click();
    cy.url().should("include", "tab=highlights");

    cy.findByRole("button", { name: /add section|create section/i }).click();
    cy.findByLabelText(/title|name/i).type(sectionName);
    cy.findByRole("button", { name: /create section/i }).click();
    cy.findByText(/section created successfully/i, { timeout: 10000 }).should(
      "be.visible"
    );

    return cy.findByText(sectionName, { timeout: 10000 }).should("exist");
  },

  verifySectionExists(sectionName: string): Cypress.Chainable<JQuery<HTMLElement>> {
    cy.findByRole("tab", { name: /sections\s*&\s*highlights/i }).click();
    cy.url().should("include", "tab=highlights");

    return cy.findByText(sectionName, { timeout: 10000 }).should("exist");
  },

  addSubsection(
    parentSectionTitle: string,
    subsectionTitle: string
  ): Cypress.Chainable<JQuery<HTMLElement>> {
    cy.findByRole("tab", { name: /sections\s*&\s*highlights/i }).click();
    cy.contains("h3", parentSectionTitle)
      .parent()
      .parent()
      .within(() => {
        cy.findByRole("button", { name: /section options/i }).click();
      });

    cy.findByRole("menuitem", { name: /add subsection/i }).click();
    cy.findByLabelText(/title/i).clear().type(subsectionTitle);
    cy.findByRole("button", { name: /create section/i }).click();

    return cy.findByText(subsectionTitle, { timeout: 10000 }).should("exist");
  },

  reorderSection(direction: Direction, sectionName?: string): void {
    const baseLabel = direction === "up" ? "Move section up" : "Move section down";
    const ariaLabel = sectionName ? `${baseLabel}: ${sectionName}` : baseLabel;

    if (sectionName) {
      cy.findByLabelText(ariaLabel).click();
    } else {
      cy.findByLabelText(new RegExp(baseLabel, "i")).first().click();
    }

    cy.wait(500);
  },
};
