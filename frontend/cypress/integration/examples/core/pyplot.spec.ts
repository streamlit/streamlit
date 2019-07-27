/// <reference types="cypress" />

describe('st.pyplot', () => {
  before(() => {
    // http://gs.statcounter.com/screen-resolution-stats/desktop/worldwide
    cy.viewport(1366, 768)
    cy.visit('http://localhost:3000/')
  })

  it('displays a pyplot figure', () => {
    cy.get('.stImage')
      .find('img')
      .should('have.attr', 'src')
  })

  it('clears the figure on rerun', () => {
    // Rerun the script
    cy.get('.stApp .decoration').trigger('keypress', {
      keyCode: 82,  // "r"
      which: 82,  // "r"
    })

    // Wait for 'stale-element' class to go away, so the snapshot looks right.
    cy.get('.element-container')
      .should('not.have.class', 'stale-element')

    cy.get('.stImage > img')
      .matchImageSnapshot('pyplot-check-if-cleared')
  })
})
