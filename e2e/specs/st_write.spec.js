describe("st.write", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  beforeEach(() => {
    cy.get(".element-container").should("have.length", 3);
  });

  it("displays markdown", () => {
    cy.getIndexed(".element-container .stMarkdown p", 0).contains(
      "This markdown is awesome! 😎"
    );
  });

  it("escapes HTML", () => {
    cy.getIndexed(".element-container .stMarkdown p", 1).contains(
      "This <b>HTML tag</b> is escaped!"
    );
  });

  it("allows HTML if defined explicitly", () => {
    cy.get(".element-container .stMarkdown p")
      .last()
      .contains("This HTML tag is not escaped!");
  });
});
