/// <reference types="cypress" />

describe('st.progress', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a progress bar', () => {
    cy.get('.element-container .stProgress .progress-bar')
      .should('have.attr', 'aria-valuenow', '50')
  })
})
