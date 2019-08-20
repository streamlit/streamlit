/// <reference types="cypress" />

describe('st.graphviz_chart', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a graph with two connected nodes', () => {
    cy.get('#graphviz-chart-0 svg')
      .matchImageSnapshot('graphviz-chart-0')
  })

  it('displays a colorful node within a cluster within a graph', () => {
    cy.get('#graphviz-chart-1 svg')
      .matchImageSnapshot('graphviz-chart-1')
  })

  it('displays a graph representing a finite state machine', () => {
    cy.get('#graphviz-chart-2 svg')
      .matchImageSnapshot('graphviz-chart-2')
  })
})
