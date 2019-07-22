/// <reference types="cypress" />

describe('st.button', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('shows widget correctly', () => {
    cy.get('.stButton')
      .should('have.length', 1)

    cy.get('.stButton')
      .matchImageSnapshot('button-widget')
  })

  it('has correct default value', () => {
    cy.get('.stText')
      .should('have.text', 'value: False')
  })

  it('sets value correctly when user clicks', () => {
    cy.get('.stButton button').click()

    cy.get('.stText')
      .should('have.text', 'value: True')
  })

  it('doesn\'t reset the value when user clicks again', () => {
    cy.get('.stButton button').click().click()

    cy.get('.stText')
      .should('have.text', 'value: True')
  })

  it('is reset when user changes another widget', () => {
    cy.get('.stButton button').click()
    cy.get('.stText').should('have.text', 'value: True')
    cy.get('.stCheckbox').click()

    cy.get('.stText')
      .should('have.text', 'value: False')
  })
})
