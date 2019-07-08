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
    cy.get('.stTextInput input').first().type('test input')

    cy.get('.stText')
      .should(
        'have.text',
        'value 1: "  "' +
          'value 2: " default text "' +
          'value 3: " 1234 "' +
          'value 4: " None "')
  })

  it('sets value correctly on enter keypress', () => {
    cy.get('.stTextInput input').first().type('test input{enter}')

    cy.get('.stText')
      .should(
        'have.text',
        'value 1: " test input "' +
          'value 2: " default text "' +
          'value 3: " 1234 "' +
          'value 4: " None "')
  })

  it('sets value correctly on blur', () => {
    cy.get('.stTextInput input').first().type('test input').blur()

    cy.get('.stText')
      .should(
        'have.text',
        'value 1: " test input "' +
          'value 2: " default text "' +
          'value 3: " 1234 "' +
          'value 4: " None "')
  })
})
