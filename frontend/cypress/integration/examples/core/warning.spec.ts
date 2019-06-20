/// <reference types="cypress" />

describe('st.warning', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a warning message', () => {
    cy.get('.element-container .stText')
      .should('contain', 'This warning message is awesome!')
  })
})
