/// <reference types="cypress" />

describe("st.bokeh_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays a bokeh chart", () => {
    cy.get(".element-container .stBokehChart").should(
      "have.css",
      "height",
      "600px"
    );
  });
});
