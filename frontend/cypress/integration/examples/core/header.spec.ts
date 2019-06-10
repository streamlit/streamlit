/// <reference types="cypress" />

describe('st.header', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a header', () => {
    cy.get('.element-container .stText h2')
      .should('contain', 'This header is awesome!')
  })
})
