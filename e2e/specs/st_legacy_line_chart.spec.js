describe("st._legacy_line_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays a line chart", () => {
    cy.get(".element-container [data-testid='stVegaLiteChart']")
      .find("canvas")
      .should("have.css", "height", "300px");
  });
});
