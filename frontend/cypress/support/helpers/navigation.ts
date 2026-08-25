type TabName = "overview" | "highlights" | "sections";

export const navigation = {
  switchToTab(tabName: TabName): void {
    const normalizedTab = tabName === "sections" ? "highlights" : tabName;
    const tabLabel =
      normalizedTab === "highlights"
        ? /sections\s*&\s*highlights/i
        : /overview/i;

    cy.findByRole("tab", { name: tabLabel }).click();
    cy.url().should("include", `tab=${normalizedTab}`);
  },
};
