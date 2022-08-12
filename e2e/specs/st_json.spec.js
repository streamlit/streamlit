describe("st.json", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays expanded json", () => {
    cy.getIndexed("[data-testid='stJson']", 0)
      .should("contain", "foo")
      .and("contain", "bar");
  });

  it("displays collapsed json", () => {
    cy.getIndexed("[data-testid='stJson']", 1).should("contain", "...");
  });
});
