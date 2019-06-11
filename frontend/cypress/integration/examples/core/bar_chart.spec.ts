/// <reference types="cypress" />

describe('st.bar_chart', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a bar chart', () => {
    cy.get('.element-container .stChart')
      .find('svg')
      .should('have.attr', 'height', '200')
  })
})
