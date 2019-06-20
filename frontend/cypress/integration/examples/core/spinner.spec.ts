/// <reference types="cypress" />

describe('st.spinner', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a spinner with default text', () => {
    cy.get('.element-container .stText')
      .should('contain', 'In progress...')
  })
})
