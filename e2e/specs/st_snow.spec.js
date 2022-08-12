describe("st.snow", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("uses negative bottom margin styling", () => {
    // snow use negative bottom margin to prevent the flexbox gap (instead of display: none like st.empty)
    cy.get(".snow")
      .eq(0)
      .parent()
      .should("have.css", "margin-bottom");

    cy.get(".snow")
      .eq(0)
      .parent()
      .should("not.have.css", "display", "none");
  });
});
