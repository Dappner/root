type LoginOptions = {
  email?: string;
  password?: string;
};

const DEFAULT_EMAIL = "admin@example.com";
const DEFAULT_PASSWORD = "password";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Log in via the UI using the login page.
       */
      loginByUI(options?: LoginOptions): Chainable<void>;
    }
  }
}

const getCredentials = (options?: LoginOptions) => {
  const email = options?.email ?? DEFAULT_EMAIL;
  const password = options?.password ?? DEFAULT_PASSWORD;

  return { email, password };
};

Cypress.Commands.add("loginByUI", (options?: LoginOptions) => {
  const { email, password } = getCredentials(options);

  cy.session(
    [email, password],
    () => {
      cy.visit("/login");

      cy.get("input#email").clear().type(email);
      cy.get("input#password").clear().type(password);

      cy.get("button[type=submit]").click();

      cy.url().should("not.include", "/login");
    },
    {
      validate() {
        // Validate session is still valid
        cy.visit("/sources");
        cy.url().should("not.include", "/login");
      },
    }
  );
});

export {};
