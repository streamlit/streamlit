describe("st.stop", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays only one piece of text", () => {
    cy.get("[data-testid='stText']").should("have.length", 1);
  });

  it("displays text before stop", () => {
    cy.get("[data-testid='stText']").should("contain", "Text before stop");
  });
});
