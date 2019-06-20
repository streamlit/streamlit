/// <reference types="cypress" />

describe('st.markdown', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a markdown', () => {
    cy.get('.element-container .stText p')
      .should('contain', 'This markdown is awesome!')
  })
})
