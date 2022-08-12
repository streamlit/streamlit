describe("st.text", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays a text", () => {
    cy.get("[data-testid='stText']").should(
      "contain",
      "This text is awesome!"
    );
  });
});
