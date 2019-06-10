/// <reference types="cypress" />

describe('st.code', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a code block', () => {
    cy.get('.element-container .stText pre')
      .should('contain', 'This code is awesome!')
  })
})
