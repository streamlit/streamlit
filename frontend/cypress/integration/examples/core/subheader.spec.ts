/// <reference types="cypress" />

describe('st.subheader', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a subheader', () => {
    cy.get('.element-container .stText h3')
      .should('contain', 'This subheader is awesome!')
  })
})
