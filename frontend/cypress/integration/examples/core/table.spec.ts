/// <reference types="cypress" />

describe('st.table', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a table', () => {
    cy.get('.element-container .stTable')
      .should('contain', '99')
  })
})
