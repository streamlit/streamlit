/// <reference types="cypress" />

describe('st.altair_chart', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays an altair chart', () => {
    cy.get('.element-container .stVegaLiteChart')
      .find('canvas')
      .should('have.attr', 'height', '400')
  })
})
