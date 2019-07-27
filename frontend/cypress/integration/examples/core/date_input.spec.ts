/// <reference types="cypress" />

describe('st.date_input', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('shows labels', () => {
    cy.get('.stDateInput label')
      .should(
        'have.text',
        'Label 1' +
        'Label 2'
      )
  })

  it('has correct values', () => {
    cy.get('.stText')
      .should(
        'have.text',
        'Value 1: 1970-01-01' +
        'Value 2: 2019-07-06'
      )
  })

  it('handles value changes', () => {
    // open date picker
    cy.get('.stDateInput')
      .first()
      .click()

    // select '1970/01/02'
    cy.get('[data-baseweb="calendar"] [aria-label^="Choose Friday, January 2nd 1970."]')
      .click()

    cy.get('.stText')
      .should(
        'have.text',
        'Value 1: 1970-01-02' +
        'Value 2: 2019-07-06'
      )
  })
})
