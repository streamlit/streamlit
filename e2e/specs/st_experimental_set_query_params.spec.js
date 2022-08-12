describe("st.experimental_query_string", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("shows button correctly", () => {
    cy.get(".stButton").should("have.length", 1);
  });

  it("sets query string correctly when user clicks", () => {
    cy.get(".stButton button").click();

    cy.url().should(
      "include",
      "http://localhost:3000/?" +
        "show_map=True&" +
        "number_of_countries=2&" +
        "selected=asia&selected=america"
    );
  });
});
