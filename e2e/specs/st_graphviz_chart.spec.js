describe("st.graphviz_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  beforeEach(() => {
    return cy
      .get(".stGraphVizChart > svg > g > title")
      .should("have.length", 5);
  });

  it("shows left and right graph", () => {
    cy.getIndexed(".stGraphVizChart > svg > g > title", 3).should(
      "contain",
      "Left"
    );
    cy.getIndexed(".stGraphVizChart > svg > g > title", 4).should(
      "contain",
      "Right"
    );
  });
});
