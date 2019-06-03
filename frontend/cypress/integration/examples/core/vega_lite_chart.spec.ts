/// <reference types="cypress" />

describe('st.vega_lite_chart', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a vega lite chart', () => {
    cy.get('.element-container .stVegaLiteChart')
      .find('canvas')
      .should('have.class', 'marks')
  })
})
