const path = require("path");

describe("st.download_button", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("shows widget correctly", () => {
    cy.get(".stDownloadButton").should("have.length", 3);
    cy.get(".stDownloadButton")
      .first()
      .matchThemedSnapshots("download-button-widget");
  });

  it("shows disabled widget correctly", () => {
    cy.get(".stDownloadButton").should("have.length", 3);
    cy.getIndexed(".stDownloadButton", 1).matchThemedSnapshots(
      "disabled-download-button"
    );
  });

  it("downloads txt file when the button is clicked", () => {
    cy.get(".stDownloadButton button")
      .first()
      .click();
    const downloadsFolder = Cypress.config("downloadsFolder");
    cy.readFile(path.join(downloadsFolder, "hello.txt")).should(
      "eq",
      "Hello world!"
    );
  });

  it("downloads RAR archive file when the button is clicked", () => {
    cy.get(".stDownloadButton button")
      .should("have.length.at.least", 3)
      .last()
      .click();
    const downloadsFolder = Cypress.config("downloadsFolder");
    cy.readFile(path.join(downloadsFolder, "archive.rar")).should("exist");
  });
});
