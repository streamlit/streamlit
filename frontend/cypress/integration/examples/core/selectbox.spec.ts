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
          'value 3: male')
  })

  it('formats display values', () => {
    cy.get('.stSelectbox span')
      .eq(1)
      .should(
        'have.text',
        'Male')
  })

  it('sets value correctly when user clicks', () => {
    cy.get('.stSelectbox')
      .each((el, idx) => {
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
          'value 3: female')
  })
})
