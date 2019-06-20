/// <reference types="cypress" />

describe('st.success', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a success message', () => {
    cy.get('.element-container .stText')
      .should('contain', 'This success message is awesome!')
  })
})
