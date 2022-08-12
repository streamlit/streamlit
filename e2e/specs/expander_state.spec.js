describe("expandable state", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("does not retain expander state for a distinct expander", () => {
    cy.getIndexed(".stButton button", 0).click();
    cy.get("[data-testid='stExpander']").click();

    cy.get("[data-testid='stExpander']").should("contain.text", "b0_write");

    cy.getIndexed(".stButton button", 1).click();

    cy.get("[data-testid='stExpander']").should(
      "not.contain.text",
      "b0_write"
    );
    cy.get("[data-testid='stExpander']").should(
      "not.contain.text",
      "b1_write"
    );
  });
});
