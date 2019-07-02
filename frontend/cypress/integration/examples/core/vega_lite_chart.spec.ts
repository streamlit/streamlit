/// <reference types="cypress" />

describe('st.vega_lite_chart', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays charts on the DOM', () => {
    cy.get('.element-container .stVegaLiteChart')
      .should('have.length', 4)

    cy.get('.element-container .stVegaLiteChart')
      .find('canvas')
      .should('have.class', 'marks')
  })

  it('sets the correct chart width', () => {
    cy.get('.stVegaLiteChart canvas')
      .eq(0).should('have.css', 'width', '572px')

    cy.get('.stVegaLiteChart canvas')
      .eq(1).should('have.css', 'width', '572px')

    cy.get('.stVegaLiteChart canvas')
      .eq(2).should('have.css', 'width', '292px')

    cy.get('.stVegaLiteChart canvas')
      .eq(3).should('have.css', 'width', '500px')
  })
})
