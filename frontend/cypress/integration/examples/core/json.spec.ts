/// <reference types="cypress" />

describe('st.json', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a json', () => {
    cy.get('.element-container .stText')
      .should('contain', 'foo')
      .and('contain', 'bar')
  })
})
