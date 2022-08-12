/// <reference types="cypress" />

describe("st.empty", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("matches the snapshot", () => {
    cy.get(".block-container").matchThemedSnapshots("stEmpty");
  });
});
