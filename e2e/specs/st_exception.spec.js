describe("st.exception", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays an exception message", () => {
    cy.get(".element-container .stException").should(
      "contain",
      "This exception message is awesome!"
    );
  });
});
