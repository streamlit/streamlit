describe("st._arrow_bar_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays a bar chart", () => {
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']")
      .find("canvas")
      .first()
      .should("have.css", "height", "350px");
  });

  it("displays all bar-chart combinations correctly", () => {
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']").should(
      "have.length",
      7
    );

    cy.get(".element-container [data-testid='stArrowVegaLiteChart']").each(
      (el, idx) => {
        return cy.wrap(el).matchThemedSnapshots("arrow_bar_chart" + idx);
      }
    );
  });
});
