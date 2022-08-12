describe("st.empty", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("uses display none styling", () => {
    cy.get(".stHidden")
      .eq(0)
      .parent()
      .should("have.css", "display", "none");
  });
});
