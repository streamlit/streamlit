/// <reference types="cypress" />

describe('kill server', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('disconnects the client', () => {
    cy.window().then((win) => {
      win.streamlitDebug.closeConnection()

      cy.get('#ConnectionStatus label')
        .should(
          'have.text',
          'Disconnected')
    })
  })
})
