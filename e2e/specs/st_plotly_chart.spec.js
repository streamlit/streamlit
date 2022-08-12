describe("st.plotly_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  beforeEach(() => {
    cy.get(".element-container").should("have.length", 1);
  });

  it("displays a plotly chart", () => {
    cy.get(".element-container .stPlotlyChart")
      .find(".modebar-btn--logo")
      .should("have.attr", "data-title")
      .and("match", /Produced with Plotly/);
  });

  it("has consistent visuals", () => {
    cy.get(".element-container .stPlotlyChart")
      .first()
      .matchThemedSnapshots("st_plotly_chart");
  });
});
