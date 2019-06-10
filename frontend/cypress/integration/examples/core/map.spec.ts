/// <reference types="cypress" />

describe('st.map', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a map', () => {
    cy.get('.element-container .stMap')
      .should('contain', 'Leaflet')
  })
})
