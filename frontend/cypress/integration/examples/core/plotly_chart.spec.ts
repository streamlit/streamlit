/// <reference types="cypress" />

describe('st.plotly_chart', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a plotly chart', () => {
    cy.get('.element-container .stPlotlyChart')
      .find('.modebar-btn--logo')
      .should('have.attr', 'data-title', 'Produced with Plotly')
  })
})
