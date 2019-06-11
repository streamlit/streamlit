/// <reference types="cypress" />

describe('st.dataframe', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays a pandas dataframe', () => {
    cy.get('.element-container .stDataFrame')
      .should('contain', '99')
  })
})
