describe("st.info", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays an info message", () => {
    cy.get(".element-container .stAlert").should(
      "contain",
      "This info message is awesome!"
    );
  });
});
