/// <reference types="cypress" />

describe('mplotlib', () => {
  before(() => {
    // http://gs.statcounter.com/screen-resolution-stats/desktop/worldwide
    cy.viewport(1366, 768)
    cy.visit('http://localhost:3000/')
  })

  it('creates consistent images', () => {
    cy.get('.stImage > img')
      .each((el, idx) => {
        cy.wrap(el).matchImageSnapshot('pyplot-visuals' + idx)
      })
  })
})
