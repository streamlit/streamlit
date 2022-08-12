describe("st.balloons", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("uses negative bottom margin styling", () => {
    // balloons use negative bottom margin to prevent the flexbox gap (instead of display: none like st.empty)
    cy.get(".balloons")
      .eq(0)
      .parent()
      .should("have.css", "margin-bottom");

    cy.get(".balloons")
      .eq(0)
      .parent()
      .should("not.have.css", "display", "none");
  });
});
