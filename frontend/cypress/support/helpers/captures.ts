export const captures = {
  addNote(noteText: string): Cypress.Chainable<JQuery<HTMLElement>> {
    cy.findByRole("button", { name: /note/i }).click();
    cy.findByLabelText(/text/i).type(noteText);
    cy.findByRole("button", { name: /create capture/i }).click();

    cy.findByText(/capture created successfully/i, { timeout: 10000 }).should(
      "be.visible"
    );

    return cy.findByText(noteText, { timeout: 10000 }).should("exist");
  },
};
