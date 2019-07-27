/// <reference types="cypress" />

describe('st.add_rows', () => {
  // Doesn't have to run before each, since these tests are stateless.
  before(() => {
    cy.visit('http://localhost:3000/')

    // Rerun the script because we want to test that JS-side coalescing works.
    cy.get('.stApp .decoration').trigger('keypress', {
      keyCode: 82,  // "r"
      which: 82,  // "r"
    })

    // Wait for 'stale-element' class to go away, so the snapshot looks right.
    cy.get('.element-container')
      .should('not.have.class', 'stale-element')
  })

  it('works for all elements that support it', () => {
    cy.get('.element-container .stTable')
      .should('have.length', 3)
    cy.get('.element-container .stDataFrame')
      .should('have.length', 4)
    cy.get('.element-container .stChart')
      .should('have.length', 3)
    cy.get('.element-container .stVegaLiteChart')
      .should('have.length', 12)
  })

  it('raises an exception when the shapes don\'t match', () => {
    cy.get('.element-container .stException')
      .should('have.length', 1)
      .contains('Dataframes have incompatible shapes')
  })

  it('correctly adds rows to tables and dataframes', () => {
    cy.get('.element-container .stTable tr').should('have.length', 10)
    cy.get('.element-container .stDataFrame .col-header').should('have.length', 7)
  })

  it('correctly adds rows to charts', () => {
    cy.get('.element-container .stChart').each((el, i) => {
      cy.get(el).matchImageSnapshot(`stChart-${i}`)
    })
    cy.get('.element-container .stVegaLiteChart').each((el, i) => {
      cy.get(el).matchImageSnapshot(`stVegaLiteChart-${i}`)
    })
  })
})
