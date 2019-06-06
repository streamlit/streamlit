/// <reference types="cypress" />

describe('st.info', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays an info message', () => {
    cy.get('.element-container .stText')
      .should('contain', 'This info message is awesome!')
  })
})
