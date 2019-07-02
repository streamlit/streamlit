/// <reference types="cypress" />

describe('st.pyplot with kwargs', () => {
  before(() => {
    cy.viewport(1366, 768)
    cy.visit('http://localhost:3000/')
  })

  it('draws long text strings correctly', () => {
    cy.get('.stImage')
      .find('img')
      .should('have.attr', 'src')

    cy.get('.stImage > img')
      .matchImageSnapshot('pyplot-long-text-strings')
  })
})
