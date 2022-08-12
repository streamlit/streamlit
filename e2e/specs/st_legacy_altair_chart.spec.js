describe("st._legacy_altair_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays an altair chart", () => {
    cy.get(".element-container [data-testid='stVegaLiteChart']")
      .find("canvas")
      .should("have.class", "marks");
  });
});
