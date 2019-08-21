/// <reference types="cypress" />

describe('st.table styling', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays unstyled table', () => {
    cy.get('.stTable')
      .eq(0)
      .find('table tbody tr td')
      .eq(0)
      .should('contain', '1')

    cy.get('.stTable')
      .eq(0)
      .matchImageSnapshot('table-unstyled')
  })

  it('displays table with custom formatted cells', () => {
    cy.get('.stTable')
      .eq(1)
      .find('table tbody tr td')
      .eq(0)
      .should('contain', '100.00%')

    cy.get('.stTable')
      .eq(1)
      .matchImageSnapshot('table-formatted-cells')
  })

  it('displays table with colored cells', () => {
    cy.get('.stTable').eq(2)
      .find('table tbody tr').eq(0)
      .find('td')
      .each((el, i) => {
        if (i < 3) {
          cy.wrap(el).should('have.css', 'color', 'rgb(0, 0, 0)')
        }
        else {
          cy.wrap(el).should('have.css', 'color', 'rgb(255, 0, 0)')
        }
      })

    cy.get('.stTable')
      .eq(2)
      .matchImageSnapshot('table-colored-cells')
  })

  it('displays table with differently styled rows', () => {
    cy.get('.stTable').eq(3)
      .find('table tbody tr').eq(0)
      .find('td').eq(0)
      .should('have.css', 'color', 'rgb(124, 252, 0)')

    cy.get('.stTable').eq(3)
      .find('table tbody tr').eq(5)
      .find('td').eq(0)
      .should('have.css', 'color', 'rgb(0, 0, 0)')

    cy.get('.stTable')
      .eq(3)
      .matchImageSnapshot('table-styled-rows')
  })
})
