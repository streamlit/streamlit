describe("st.warning", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays a warning message", () => {
    cy.get(".element-container .stAlert").should(
      "contain",
      "This warning message is awesome!"
    );
  });
});
