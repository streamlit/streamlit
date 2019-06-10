/// <reference types="cypress" />

describe('st.error', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays an error message', () => {
    cy.get('.element-container .stText')
      .should('contain', 'This error message is awesome!')
  })
})
