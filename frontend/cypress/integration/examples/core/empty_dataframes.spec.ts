/// <reference types="cypress" />

describe('Dataframes', () => {
  const DF_SELECTOR = '.stDataFrame'
  const TABLE_SELECTOR = '.stTable > table'

  before(() => {
    // http://gs.statcounter.com/screen-resolution-stats/desktop/worldwide
    cy.visit('http://localhost:3000/')

    cy.wait(1000)

    // Force our header to scroll with the page, rather than
    // remaining fixed. This prevents us from occasionally getting
    // the little multi-colored ribbon at the top of our screenshots.
    cy.get('.stApp > header').invoke('css', 'position', 'absolute')
  })

  it('have consistent empty list visuals', () => {
    cy.get('.element-container')
      .eq(1)
      .each(el => {
        cy.wrap(el).matchImageSnapshot()
      })
  })

  it('have consistent empty visuals', () => {
    cy.get(DF_SELECTOR)
      .filter(idx => idx >= 0 && idx <= 5)
      .each(el => {
        cy.wrap(el).matchImageSnapshot()
      })
  })

  it('have consistent empty one-column visuals', () => {
    cy.get(DF_SELECTOR)
      .filter(idx => idx >= 6 && idx <= 7)
      .each(el => {
        cy.wrap(el).matchImageSnapshot()
      })
  })

  it('have consistent empty two-column visuals', () => {
    cy.get(DF_SELECTOR)
      .filter(idx => idx >= 8 && idx <= 9)
      .each(el => {
        cy.wrap(el).matchImageSnapshot()
      })
  })

  it('have consistent empty table visuals', () => {
    cy.get(TABLE_SELECTOR)
      .filter(idx => idx >= 0 && idx <= 3)
      .each(el => {
        cy.wrap(el).matchImageSnapshot()
      })
  })

  it('have consistent empty one-column table visuals', () => {
    cy.get(TABLE_SELECTOR)
      .eq(4)
      .each(el => {
        cy.wrap(el).matchImageSnapshot()
      })
  })

  it('have consistent empty two-column table visuals', () => {
    cy.get(TABLE_SELECTOR)
      .eq(5)
      .each(el => {
        cy.wrap(el).matchImageSnapshot()
      })
  })
})
