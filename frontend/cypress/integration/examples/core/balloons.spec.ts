/// <reference types="cypress" />

describe('st.balloons', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays balloons', () => {
    cy.get('.element-container')
      .find('.balloons')
  })
})
