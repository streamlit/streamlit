/// <reference types="cypress" />

describe('st.pyplot with kwargs', () => {
  before(() => {
    cy.visit('http://localhost:3000/')
  })

  it('draws long text strings correctly', () => {
    cy.wait(20000)

    cy.get('.stImage')
      .find('img')
      .should('have.attr', 'src')

    cy.get('.stImage > img')
      .matchImageSnapshot('pyplot-long-text-strings')
  })
})
