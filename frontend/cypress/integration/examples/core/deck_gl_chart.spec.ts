/// <reference types="cypress" />

describe('st.deck_gl_chart', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a deck.gl chart', () => {
    cy.get('.element-container .stDeckGlChart')
      .find('canvas')
      .should('have.attr', 'height', '1000')
  })
})
