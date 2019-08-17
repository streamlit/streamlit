/// <reference types="cypress" />

describe('st.selectbox', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('shows widget correctly', () => {
    cy.get('.stSelectbox')
      .should('have.length', 3)

    cy.get('.stSelectbox')
      .each((el, idx) => {
        cy.wrap(el).matchImageSnapshot('selectbox' + idx)
      })
  })

  it('has correct initial values', () => {
    cy.get('.stText')
      .should(
        'have.text',
        'value 1: female' +
          'value 2: male' +
          'value 3: None')
  })

  it('formats display values', () => {
    cy.get('.stSelectbox span')
      .eq(1)
      .should(
        'have.text',
        'Male')
  })

  it('handles no options', () => {
    cy.get('.stSelectbox span')
      .eq(2)
      .should(
        'have.text',
        'No options to select.')

    cy.get('.stSelectbox input')
      .eq(2)
      .should('be.disabled')
  })

  it('sets value correctly when user clicks', () => {
    cy.get('.stSelectbox')
      .eq(1)
      .then((el) => {
        cy.wrap(el)
          .find('input')
          .click()
        cy.get('li')
          .last()
          .click()
      })

    cy.get('.stText')
      .should(
        'have.text',
        'value 1: female' +
          'value 2: female' +
          'value 3: None')
  })
})
