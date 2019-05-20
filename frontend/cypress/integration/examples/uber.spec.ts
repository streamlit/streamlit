/// <reference types="cypress" />

describe('Uber Example', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('can set geo data hour', () => {
    const h = Cypress._.random(0, 24)

    cy.get('#MainMenuButton')
      .click()

    cy.contains('Edit command')
      .click()

    // TODO: fix issue with the letter R
    cy.get('.command-line')
      .clear()
      .type('examples/ube.py ' + h)

    cy.get('.modal')
      .contains('Rerun')
      .click()

    cy.contains('Geo Data')
      .should('contain', h)
  })
})
