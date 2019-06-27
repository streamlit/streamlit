/// <reference types="cypress" />

describe('st.image', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays an image', () => {
    cy.get('.element-container .stImage img')
      .should('have.css', 'height', '102px')
      .should('have.css', 'width', '102px')
  })

  it('displays a caption', () => {
    cy.get('.element-container .stImage .caption')
      .should('contain', 'Black Square')
  })
})
