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

      // Snapshot `toolbar` instead of `ConnectionStatus` so we have a larger
      // bounding box and a lower percentage difference on the snapshot diff
      cy.get('.toolbar')
        .matchImageSnapshot('disconnected')
    })
  })
})
