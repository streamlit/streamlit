describe("st.experimental_rerun", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("restarts the session when invoked", () => {
    cy.get("[data-testid='stText']").should(
      "contain",
      "Being able to rerun a session is awesome!"
    );
  });
});
