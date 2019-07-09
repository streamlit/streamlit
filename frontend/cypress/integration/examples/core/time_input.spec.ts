/// <reference types="cypress" />

describe('st.time_input', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('shows labels', () => {
    cy.get('.stTimeInput label')
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
        'Value 1: 08:45:00' +
        'Value 2: 21:15:00'
      )
  })
})
