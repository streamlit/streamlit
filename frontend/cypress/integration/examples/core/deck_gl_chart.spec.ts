/// <reference types="cypress" />

describe('st.deck_gl_chart', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays 2 deck.gl charts', () => {
    const els = cy.get('.element-container .stDeckGlChart')

    els.should('have.length', 6)

    els.find('canvas')
      .should('have.attr', 'height', '1000')
  })
})
