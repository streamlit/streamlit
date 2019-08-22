/// <reference types="cypress" />

describe('st.text_area', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('shows widget correctly', () => {
    cy.get('.stTextArea')
      .should('have.length', 4)

    cy.get('.stTextArea')
      .each((el, idx) => {
        cy.wrap(el)
          .scrollIntoView()
          .matchImageSnapshot('text_area' + idx)
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
    cy.get('.stTextArea textarea').first().type('test area{enter}')

    cy.get('.stText')
      .should(
        'have.text',
        'value 1: "  "' +
          'value 2: " default text "' +
          'value 3: " 1234 "' +
          'value 4: " None "')
  })

  it('sets value correctly on ctrl-enter keypress', () => {
    cy.get('.stTextArea textarea').first().type('test area{ctrl}{enter}')

    cy.get('.stText')
      .should(
        'have.text',
        'value 1: " test area "' +
          'value 2: " default text "' +
          'value 3: " 1234 "' +
          'value 4: " None "')
  })

  it('sets value correctly on blur', () => {
    cy.get('.stTextArea textarea').first().type('test area').blur()

    cy.get('.stText')
      .should(
        'have.text',
        'value 1: " test area "' +
          'value 2: " default text "' +
          'value 3: " 1234 "' +
          'value 4: " None "')
  })
})
