describe("st._arrow_altair_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays an altair chart", () => {
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']")
      .first()
      .find("canvas")
      .should("have.class", "marks");
  });

  it("displays correctly", () => {
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']").should(
      "have.length",
      7
    );

    cy.get(".element-container [data-testid='stArrowVegaLiteChart']").each(
      (el, idx) => {
        return cy.wrap(el).matchThemedSnapshots("altair_chart_" + idx);
      }
    );
  });
});
