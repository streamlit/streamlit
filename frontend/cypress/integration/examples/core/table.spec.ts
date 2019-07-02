/// <reference types="cypress" />

describe('st.table', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')

    cy.get('.element-container .stTable tbody tr').as('rows')
    cy.get('.element-container .stTable tbody td').as('cells')
  })

  it('displays a table', () => {
    cy.get('.element-container')
      .find('.stTable')
  })

  it('checks number of rows', () => {
    cy.get('@rows')
      .its('length')
      .should('eq', 10)
  })

  it('checks number of cells', () => {
    cy.get('@cells')
      .its('length')
      .should('eq', 100)
  })

  it('contains all numbers from 0..99', () => {
    cy.get('@cells')
      .each(($element, index) => {
        cy.wrap($element)
          .should('contain', index)
      })
  })

  it('looks the same', () => {
    // (HK) TODO: diff screenshots
  })
})
