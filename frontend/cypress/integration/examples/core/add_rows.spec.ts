/// <reference types="cypress" />

describe('st.add_rows', () => {
  // Doesn't have to run before each, since these tests are stateless.
  before(() => {
    cy.visit('http://localhost:3000/')

    // Rerun the script because we want to test that JS-side coalescing works.
    cy.get('.stApp > header').type('r')
  })

  it('works for all elements that support it', () => {
    cy.get('.element-container .stTable')
      .should('have.length', 2)
    cy.get('.element-container .stDataFrame')
      .should('have.length', 2)
    cy.get('.element-container .stChart')
      .should('have.length', 2)
    cy.get('.element-container .stVegaLiteChart')
      .should('have.length', 8)
  })

  it('raises an exception when the shapes don\'t match', () => {
    cy.get('.element-container .stException')
      .should('have.length', 1)
  })

  it('correctly adds rows to tables and dataframes', () => {
    cy.get('.element-container .stTable tr').should('have.length', 8)
    cy.get('.element-container .stDataFrame .col-header').should('have.length', 6)
  })
})
