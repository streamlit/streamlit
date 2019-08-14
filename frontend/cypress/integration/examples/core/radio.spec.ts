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
        'value 1: male' +
          'value 2: female' +
          'value 3: None')
  })

  it('formats display values', () => {
    cy.get('.stRadio [role="radiogroup"]')
      .eq(1)
      .should(
        'have.text',
        'FemaleMale')
  })

  it('handles no options', () => {
    cy.get('.stRadio [role="radiogroup"]')
      .eq(2)
      .should(
        'have.text',
        'No options to select.')

    cy.get('.stRadio [role="radiogroup"]')
      .eq(2)
      .get('input')
      .should('be.disabled')
  })

  it('sets value correctly when user clicks', () => {
    cy.get('.stRadio')
      .each((el, idx) => {
        cy.wrap(el).find('input').last().click({'force': true})
      })

    cy.get('.stText')
      .should(
        'have.text',
        'value 1: male' +
          'value 2: male' +
          'value 3: None')
  })
})
