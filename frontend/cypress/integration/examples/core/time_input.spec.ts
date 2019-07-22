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

  it('handles value changes', () => {
    // open time picker
    cy.get('.stTimeInput')
      .first()
      .click()

    // select '00:00'
    cy.get('[data-baseweb="menu"] [role="option"]')
      .first()
      .click()

    cy.get('.stText')
      .first()
      .should('have.text', 'Value 1: 00:00:00')
  })

  it('allows creatable values', () => {
    cy.get('.stTimeInput input')
      .first()
      .type('1:11')

    cy.get('li')
      .first()
      .click()

    cy.get('.stText')
      .first()
      .should('have.text', 'Value 1: 01:11:00')
  })
})
