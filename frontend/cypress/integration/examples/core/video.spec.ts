/// <reference types="cypress" />

describe('st.video', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a video player', () => {
    cy.get('.element-container .stVideo')
      .should('have.attr', 'src')
  })
})
