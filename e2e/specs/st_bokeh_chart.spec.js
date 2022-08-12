describe("st.bokeh_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  beforeEach(() => {
    return cy.get(".stBokehChart").should("have.length", 3);
  });

  it("shows left and right graph", () => {
    cy.getIndexed(".stBokehChart", 1).find("canvas");
    cy.getIndexed(".stBokehChart", 2).find("canvas");
  });
});
