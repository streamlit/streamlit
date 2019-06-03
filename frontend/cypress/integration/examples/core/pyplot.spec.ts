/// <reference types="cypress" />

describe('st.pyplot', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a pyplot figure', () => {
    cy.get('.element-container .stImage')
      .find('img')
      .should('have.attr', 'src')
  })
})
