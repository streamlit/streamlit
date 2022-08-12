/// <reference types="cypress" />

describe("st.pyplot with kwargs", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    // Wait for the site to be fully loaded
    cy.contains("Done!", { timeout: 100000 }).should($els => {
      expect($els).to.have.length.of.at.least(1);
    });

    cy.prepForElementSnapshots();
  });

  it("draws long text strings correctly", () => {
    cy.get("[data-testid='stImage']")
      .find("img")
      .should("have.attr", "src");
    cy.get("[data-testid='stImage'] > img").matchThemedSnapshots(
      "pyplot-long-text-strings"
    );
  });
});
