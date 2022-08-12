describe("st.latex", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays LaTeX symbol", () => {
    cy.getIndexed(".element-container .stMarkdown", 0).should(
      "contain",
      "LATE​X"
    );
  });

  it("displays Sympy expression as LaTeX", () => {
    cy.getIndexed(".element-container .stMarkdown", 1).should(
      "contain",
      "a + b"
    );
  });
});
