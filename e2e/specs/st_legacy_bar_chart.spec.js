describe("st._legacy_bar_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays a bar chart", () => {
    cy.get(".element-container [data-testid='stVegaLiteChart']")
      .find("canvas")
      .should("have.css", "height", "300px");
  });
});
