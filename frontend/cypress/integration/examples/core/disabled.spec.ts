/// <reference types="cypress" />

/*
 * Disabling widgets have their own spec since we
 * can't run other tests after we kill the server
 */
describe('disable widgets', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('disconnects the client and disables widgets', () => {
    cy.get('.stButton button')
      .should('not.be.disabled')

    cy.get('.stText')
      .should(
        'have.text',
        'Value 1: 25')

    cy.window().then((win) => {
      win.streamlitDebug.closeConnection()

      cy.get('.stButton button')
        .should('be.disabled')

      cy.get('.stCheckbox input')
        .should('be.disabled')

      cy.get('.stDateInput input')
        .should('be.disabled')

      cy.get('.stRadio input')
        .should('be.disabled')

      cy.get('.stSelectbox input')
        .should('be.disabled')

      cy.get('.stTextArea textarea')
        .should('be.disabled')

      cy.get('.stTextInput input')
        .should('be.disabled')

      cy.get('.stTimeInput input')
        .should('be.disabled')

      // slider doesn't have a `disabled` attribute
      cy.get('.stSlider [role="slider"]')
        .first()
        .parent()
        .click()

      cy.get('.stText')
        .should(
          'have.text',
          'Value 1: 25'
        )

      cy.get('.streamlit-container')
        .matchImageSnapshot('disabled-widgets')
    })
  })
})
