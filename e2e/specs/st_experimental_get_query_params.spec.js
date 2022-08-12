describe("st.experimental_get_query_string", () => {
  beforeEach(() => {
    cy.loadApp(
      "http://localhost:3000/?" +
        "show_map=True&number_of_countries=2&selected=asia&selected=america"
    );

    cy.prepForElementSnapshots();
  });

  it("shows query string correctly", () => {
    cy.get(".element-container [data-testid='stMarkdownContainer']").should(
      "have.length",
      1
    );
    cy.contains(
      "Current query string is: {" +
        "'show_map': ['True'], " +
        "'number_of_countries': ['2'], " +
        "'selected': ['asia', 'america']" +
        "}"
    );
  });
});
