/// <reference types="cypress" />

describe('st.write', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a text', () => {
    cy.get('.element-container .stText p')
      .should('contain', 'This text is awesome!')
  })
})
