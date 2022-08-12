describe("st._arrow_area_chart, st._arrow_bar_chart, st._arrow_line_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("display times in UTC", () => {
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']")
      .find("canvas")
      .each((el, i) => {
        return cy.get(el).matchImageSnapshot(`arrowChartUTCTime-${i}`);
      });
  });
});
