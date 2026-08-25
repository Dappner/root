import { captures, citations, navigation, sections, sources } from "../support/helpers";

describe("Sources Smoke Test", () => {
  beforeEach(() => {
    cy.loginByUI(); // cy.session() will cache and restore automatically
    cy.visit("/sources");
  });

  it("performs end-to-end flows on a single source", () => {
    const title = `All-in-One Source ${Date.now()}`;
    const updatedTitle = `Updated ${title}`;
    const sectionMain = `Main Section ${Date.now()}`;
    const sectionSecondary = `Secondary Section ${Date.now()}`;
    const nestedSection = `Nested Section ${Date.now()}`;
    const citationText = `Citation text ${Date.now()}`;
    const noteText = `Note content ${Date.now()}`;

    // Create and open source
    sources.createSource(title);
    sources.openSource(title);

    // Work in the combined highlights tab
    navigation.switchToTab("highlights");

    // Create sections
    sections.addSection(sectionMain);
    sections.addSection(sectionSecondary);
    sections.verifySectionExists(sectionMain);
    sections.verifySectionExists(sectionSecondary);

    // Add a citation and move it into a section
    citations.addCitation(citationText);
    citations.verifyCitationExists(citationText);
    citations.moveCitationToSection(citationText, sectionMain);

    // Add a nested section under the main section
    sections.addSubsection(sectionMain, nestedSection);
    sections.verifySectionExists(nestedSection);

    // Add a note (capture)
    captures.addNote(noteText);

    // Reorder sections briefly to ensure controls respond
    sections.reorderSection("down");
    sections.reorderSection("up");

    // Switch tabs to confirm navigation still works
    navigation.switchToTab("overview");
    navigation.switchToTab("highlights");

    // Update and archive the source, then clean up
    sources.updateSourceTitle(updatedTitle);
    sources.archiveSource();
    sources.deleteSource();

    // Verify deletion
    cy.findByText(updatedTitle).should("not.exist");
  });
});
