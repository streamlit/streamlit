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
    // trigger click in the center of the slider
    cy.get('.stSlider [role="slider"]')
      .first()
      .parent()
      .click()

    cy.get('.stText')
      .first()
      .should(
        'have.text',
        'Value 1: 50'
      )
  })

  it('increments the value on right arrow key press', () => {
    cy.get('.stSlider [role="slider"]')
      .first()
      .click()
      .type('{rightarrow}')

    cy.get('.stText')
      .first()
      .should(
        'have.text',
        'Value 1: 26'
      )
  })

  it('decrements the value on left arrow key press', () => {
    cy.get('.stSlider [role="slider"]')
      .first()
      .click()
      .type('{leftarrow}')

    cy.get('.stText')
      .first()
      .should(
        'have.text',
        'Value 1: 24'
      )
  })
})
