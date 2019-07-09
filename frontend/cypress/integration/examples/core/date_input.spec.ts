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
        'Value 1: 1970\\-01\\-01' +
        'Value 2: 2019\\-07\\-06'
      )
  })
})
