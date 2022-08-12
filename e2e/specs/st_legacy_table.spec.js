describe("st._legacy_table", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.get(".element-container [data-testid='stTable'] tbody tr").as("rows");
    cy.get(".element-container [data-testid='stTable'] tbody td").as("cells");
  });

  it("displays a table", () => {
    cy.get(".element-container").find("[data-testid='stTable']");
  });

  it("checks number of rows", () => {
    cy.get("@rows")
      .its("length")
      .should("eq", 10);
  });

  it("checks number of cells", () => {
    cy.get("@cells")
      .its("length")
      .should("eq", 100);
  });

  it("contains all numbers from 0..99", () => {
    cy.get("@cells").each(($element, index) => {
      return cy.wrap($element).should("contain", index);
    });
  });
});
