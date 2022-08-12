describe("st._arrow_table", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();

    // Wait for all the tables to be loaded.
    cy.get("[data-testid='stTable']").should("have.length", 10);
  });

  it("has consistent visuals", () => {
    cy.get("[data-testid='stTable']").each(($element, index) => {
      return cy
        .wrap($element)
        .matchThemedSnapshots("arrow-table-visuals" + index);
    });
  });
});
