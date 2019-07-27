/// <reference types="cypress" />

describe('st.vega_lite_chart', () => {
  before(() => {
    // http://gs.statcounter.com/screen-resolution-stats/desktop/worldwide
    cy.viewport(1366, 768)
    cy.visit('http://localhost:3000/')

    // Force our header to scroll with the page, rather than
    // remaining fixed. This prevents us from occasionally getting
    // the little multi-colored ribbon at the top of our screenshots.
    cy.get('.stApp > header').invoke('css', 'position', 'absolute')
  })

  it('displays charts on the DOM', () => {
    cy.get('.element-container .stVegaLiteChart')
      .find('canvas')
      .should('have.class', 'marks')
  })

  it('sets the correct chart width', () => {
    cy.get('.stVegaLiteChart canvas')
      .eq(0).should('have.css', 'width', '572px')

    cy.get('.stVegaLiteChart canvas')
      .eq(1).should('have.css', 'width', '572px')

    cy.get('.stVegaLiteChart canvas')
      .eq(2).should('have.css', 'width', '293px')

    cy.get('.stVegaLiteChart canvas')
      .eq(3).should('have.css', 'width', '500px')
  })

  it('supports different ways to get the same plot', () => {
    cy.get('.stVegaLiteChart')
      .filter(idx => idx >= 4 && idx <= 7)
      .each(el => {
        cy.wrap(el).matchImageSnapshot()
      })
  })
})
