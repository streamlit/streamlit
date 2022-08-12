describe("st._legacy_area_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays an area chart", () => {
    cy.get(".element-container [data-testid='stVegaLiteChart']")
      .find("canvas")
      .should("have.css", "height", "300px");
  });
});
