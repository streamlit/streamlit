/// <reference types="cypress" />

describe('st.radio', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('shows widget correctly', () => {
    cy.get('.stRadio')
      .should('have.length', 3)

    cy.get('.stRadio')
      .each((el, idx) => {
        cy.wrap(el).matchImageSnapshot('radio' + idx)
      })
  })

  it('has correct initial values', () => {
    cy.get('.stText')
      .should(
        'have.text',
        'value 1: 1' +
          'value 2: 0' +
          'value 3: 0')
  })

  it('sets value correctly when user clicks', () => {
    cy.get('.stRadio')
      .each((el, idx) => {
        cy.wrap(el).find('input').last().click({'force': true})
      })

    cy.get('.stText')
      .should(
        'have.text',
        'value 1: 1' +
          'value 2: 1' +
          'value 3: 1')
  })
})
