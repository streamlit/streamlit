/// <reference types="cypress" />

describe('st.text_input', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('shows widget correctly', () => {
    cy.get('.stTextInput')
      .should('have.length', 4)

    cy.get('.stTextInput')
      .each((el, idx) => {
        cy.wrap(el).matchImageSnapshot('text_input' + idx)
      })
  })

  it('has correct default values', () => {
    cy.get('.stText')
      .should(
        'have.text',
        'value 1: "  "' +
          'value 2: " default text "' +
          'value 3: " 1234 "' +
          'value 4: " None "')
  })

  it('sets value correctly when user types', () => {
    cy.get('.stTextInput input').each(el => {
      cy.wrap(el).type('test input')
    })

    cy.get('.stText')
      .should(
        'have.text',
        'value 1: " test input "' +
          'value 2: " default texttest input "' +
          'value 3: " 1234test input "' +
          'value 4: " Nonetest input "')
  })
})
