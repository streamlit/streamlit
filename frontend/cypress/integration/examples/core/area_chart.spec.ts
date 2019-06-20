/// <reference types="cypress" />

describe('st.area_chart', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays an area chart', () => {
    cy.get('.element-container .stChart')
      .find('svg')
      .should('have.attr', 'height', '200')
  })
})
