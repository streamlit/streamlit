describe("st._legacy_area, legacy_bar, and legacy_line charts", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("display times in UTC", () => {
    cy.get(".element-container [data-testid='stVegaLiteChart']")
      .find("canvas")
      .each((el, i) => {
        return cy.get(el).matchImageSnapshot(`legacyChartUTCTime-${i}`);
      });
  });
});
