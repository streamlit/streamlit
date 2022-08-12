describe("st._legacy_vega_lite_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays charts on the DOM", () => {
    cy.get(".element-container [data-testid='stVegaLiteChart']")
      .find("canvas")
      .should("have.class", "marks");
  });

  it("sets the correct chart width", () => {
    cy.getIndexed("[data-testid='stVegaLiteChart'] canvas", 0).should(
      "have.css",
      "width",
      "666px"
    );

    cy.getIndexed("[data-testid='stVegaLiteChart'] canvas", 1).should(
      "have.css",
      "width",
      "666px"
    );

    cy.getIndexed("[data-testid='stVegaLiteChart'] canvas", 2).should(
      "have.css",
      "width",
      "400px"
    );

    cy.getIndexed("[data-testid='stVegaLiteChart'] canvas", 3).should(
      "have.css",
      "width",
      "500px"
    );
  });

  it("displays interactive charts correctly", () => {
    cy.getIndexed("[data-testid='stVegaLiteChart']", 4).matchThemedSnapshots(
      `interactive_legacy_vega_lite_chart`
    );
  });

  it("supports different ways to get the same plot", () => {
    cy.get("[data-testid='stVegaLiteChart']")
      .filter(idx => idx >= 5 && idx <= 8)
      .each((el, idx) => {
        return cy
          .wrap(el)
          .matchThemedSnapshots(`legacy_vega_lite_chart${idx}`);
      });
  });
});
