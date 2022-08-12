// Regression test for https://github.com/streamlit/streamlit/issues/3873

describe("checkbox state update regression", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("checking one disables the other", () => {
    cy.get("[data-baseweb='checkbox']").should("have.length", 2);
    cy.getIndexed("[type='checkbox']", 0).should(
      "have.attr",
      "aria-checked",
      "true"
    );
    cy.getIndexed("[type='checkbox']", 1).should(
      "have.attr",
      "aria-checked",
      "false"
    );

    cy.getIndexed("[data-baseweb='checkbox']", 1).click();
    cy.getIndexed("[type='checkbox']", 0).should(
      "have.attr",
      "aria-checked",
      "false"
    );
    cy.getIndexed("[type='checkbox']", 1).should(
      "have.attr",
      "aria-checked",
      "true"
    );
  });
});
