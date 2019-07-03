/// <reference types="cypress" />

describe('st.checkbox', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('shows widget correctly', () => {
    cy.get('.stCheckbox')
      .should('have.length', 3)

    cy.get('.stCheckbox')
      .each((el, idx) => {
        cy.wrap(el).matchImageSnapshot('checkbox' + idx)
      })
  })

  it('has correct initial values', () => {
    cy.get('.stText')
      .should(
        'have.text',
        'value 1: True' +
          'value 2: False' +
          'value 3: False')
  })

  it('sets value correctly when user clicks', () => {
    cy.get('.stCheckbox').click({ multiple: true })

    cy.get('.stText')
      .should(
        'have.text',
        'value 1: False' +
          'value 2: True' +
          'value 3: True')
  })
})
