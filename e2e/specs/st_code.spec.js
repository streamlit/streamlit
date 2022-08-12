describe("st.code", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays a code block", () => {
    cy.get(".element-container .stMarkdown pre").should(
      "contain",
      "This code is awesome!"
    );
  });

  it("highlights syntax correctly", () => {
    cy.get(".block-container").matchThemedSnapshots("syntax_highlighting");
  });
});
