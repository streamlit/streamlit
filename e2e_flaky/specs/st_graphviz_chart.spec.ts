/// <reference types="cypress" />

describe("st.graphviz_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  beforeEach(() => {
    return cy.get(".stGraphVizChart").should("have.length", 3);
  });

  it("displays a graph with two connected nodes", () => {
    cy.get("#graphviz-chart-0 svg").matchThemedSnapshots("graphviz-chart-0");
  });

  it("displays a colorful node within a cluster within a graph", () => {
    cy.get("#graphviz-chart-1 svg").matchThemedSnapshots("graphviz-chart-1");
  });

  it("displays a graph representing a finite state machine", () => {
    cy.get("#graphviz-chart-2 svg").matchThemedSnapshots("graphviz-chart-2");
  });
});
