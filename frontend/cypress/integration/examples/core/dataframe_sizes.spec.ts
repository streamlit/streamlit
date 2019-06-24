/// <reference types="cypress" />

describe('Dataframes', () => {
  const DF_SELECTOR = '.stDataFrame'
  const TABLE_SELECTOR = '.stTable > table.table'

  before(() => {
    // http://gs.statcounter.com/screen-resolution-stats/desktop/worldwide
    cy.viewport(1366, 768)
    cy.visit('http://localhost:3000/')
  })

  it('show a tooltip for each cell', () => {
    // Each cell's title should be equal to its text content.
    // (We just check the first dataframe, rather than every single one.)
    cy.get(DF_SELECTOR).first().within(() => {
      cy.get(`div.data`).each(el => {
        expect(el.text()).to.eq(el.attr('title'))
      })
    })
  })

  it('have consistent st.dataframe visuals', () => {
    cy.get(DF_SELECTOR)
      .each((el, idx) => {
        cy.wrap(el).matchImageSnapshot('dataframe-visuals' + idx)
      })
  })

  it('have consistent st.table visuals', () => {
    cy.get(TABLE_SELECTOR)
      .each((el, idx) => {
        cy.wrap(el).matchImageSnapshot('table-visuals' + idx)
      })
  })
})
