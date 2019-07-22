/// <reference types="cypress" />

describe('st.slider', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('shows labels', () => {
    cy.get('.stSlider label')
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
        'Value 1: 25' +
        'Value 2: (25.0, 75.0)'
      )
  })

  it('handles value changes', () => {
    // Trigger click in the center of the slider
    cy.get('.stSlider [role="slider"]')
      .first()
      .parent()
      .click()

    cy.get('.stText')
      .should(
        'have.text',
        'Value 1: 50' +
        'Value 2: (25.0, 75.0)'
      )
  })
})
