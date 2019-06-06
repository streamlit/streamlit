/// <reference types="cypress" />

describe('st.text', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a text', () => {
    cy.get('.element-container .stText')
      .should('contain', 'This text is awesome!')
  })
})
