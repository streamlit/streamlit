describe("st_arrow_new_feautres", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();

    // Wait for all the tables to be loaded.
    cy.get("[data-testid='stTable']").should("have.length", 7);
  });

  it("has consistent visuals", () => {
    cy.get("[data-testid='stTable']").each(($element, index) => {
      return cy
        .wrap($element)
        .matchThemedSnapshots("arrow-new-features-visuals" + index);
    });
  });
});
