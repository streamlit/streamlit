describe("message_deduping", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays two dataframes", () => {
    // Hack to make Cypress wait a little bit before searching for stDataFrame.
    // (This waits for 2 suspense placeholders and 1 st.write() to show)
    cy.get(".element-container .stMarkdown").should("have.text", "hello!");

    cy.get(".element-container .stDataFrame").should("have.length", 2);
  });
});
