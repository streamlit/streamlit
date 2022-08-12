describe("st.success", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays a success message", () => {
    cy.get(".element-container .stAlert").should(
      "contain",
      "This success message is awesome!"
    );
  });
});
