describe("reuse widget label", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("reuses a widget label for different widget types", () => {
    cy.get('.stSlider [role="slider"]').should("exist");

    cy.get(".stSelectbox").should("not.exist");

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "value 1: 25");

    // Trigger click in the center of the slider so that
    // the widget state for the label gets a value, which
    // is of a different type than the value for the selectbox
    cy.get('.stSlider [role="slider"]')
      .first()
      .parent()
      .click();

    cy.get(".stSelectbox").should("exist");

    cy.get('.stSlider [role="slider"]').should("not.exist");

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "value 1: f");
  });
});
