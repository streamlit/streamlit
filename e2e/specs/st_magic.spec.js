describe("streamlit magic", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays expected text", () => {
    const expected = [
      "no block",
      "This should be printed",
      "IF",
      "ELIF",
      "ELSE",
      "FOR",
      "WHILE",
      "WITH",
      "TRY",
      "EXCEPT",
      "FINALLY",
      "FUNCTION",
      "ASYNC FUNCTION",
      "ASYNC FOR",
      "ASYNC WITH"
    ];

    const selector = ".element-container > .stMarkdown p";

    cy.get(selector).should("have.length", expected.length);

    expected.forEach((text, index) => {
      cy.getIndexed(selector, index).contains(text);
    });
  });
});
