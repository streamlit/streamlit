describe("st.error", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays an error message", () => {
    cy.get(".element-container .stAlert").should(
      "contain",
      "This error message is awesome!"
    );
  });
});
