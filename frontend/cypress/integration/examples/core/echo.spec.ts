/// <reference types="cypress" />

describe('st.echo', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('echos a code', () => {
    cy.get('.element-container .stText')
      .should('contain', 'print("This code is awesome!")')
  })
})
