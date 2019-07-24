/// <reference types="cypress" />

describe('kill server', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('disconnects the client', () => {
    cy.get('#ConnectionStatus')
      .should('not.exist')

    cy.window().then((win) => {
      win.streamlitDebug.closeConnection()

      cy.get('#ConnectionStatus label')
        .should(
          'have.text',
          'Connecting')

      cy.get('#ConnectionStatus')
        .matchImageSnapshot('disconnected')
    })
  })
})
