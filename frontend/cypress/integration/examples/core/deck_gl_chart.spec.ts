/// <reference types="cypress" />

describe('st.deck_gl_chart', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  // There is an issue between cypress and deck.gl:
  // https://github.com/cypress-io/cypress/issues/4322

  // it('displays a deck.gl chart', () => {
  //   cy.get('.element-container .stDeckGlChart')
  //     .find('canvas')
  //     .should('have.attr', 'height', '1000')
  // })
})
