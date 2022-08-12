describe("st._arrow_line_chart_add_rows_special", () => {
  // Increasing timeout since we're waiting for
  // chart to be rendered.
  Cypress.config("defaultCommandTimeout", 30000);

  // Doesn't have to run before each, since these tests are stateless.
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("correctly adds rows to a line chart", () => {
    cy.get("[data-testid='stArrowVegaLiteChart']").matchThemedSnapshots(
      "arrowLineChartAddRows"
    );
  });
});
