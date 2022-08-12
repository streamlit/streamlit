describe("st.form", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays both buttons", () => {
    cy.get("[data-testid=stFormSubmitButton]").should("have.length", 2);
  });
});
