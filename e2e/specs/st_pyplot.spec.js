describe("st.pyplot", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays a pyplot figure", () => {
    cy.get("[data-testid='stImage']")
      .find("img")
      .should("have.attr", "src");
  });

  it("clears the figure on rerun", () => {
    cy.rerunScript();

    // Wait for 'data-stale' attr to go away, so the snapshot looks right.
    cy.get(".element-container")
      .should("have.attr", "data-stale", "false")
      .invoke("css", "opacity", "1");

    cy.prepForElementSnapshots();

    cy.get("[data-testid='stImage'] > img")
      .first()
      .matchImageSnapshot("pyplot-check-if-cleared");
  });

  it("shows deprecation warning", () => {
    cy.get("[data-testid='stImage']")
      .first()
      .closest(".element-container")
      .prev()
      .should("contain", "PyplotGlobalUseWarning");
  });

  it("hides deprecation warning", () => {
    cy.getIndexed("[data-testid='stImage']", 1)
      .closest(".element-container")
      .prev()
      .should("not.contain", "PyplotGlobalUseWarning");
  });
});
