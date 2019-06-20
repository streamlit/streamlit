/// <reference types="cypress" />

describe('st.audio', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays an audio player', () => {
    cy.get('.element-container .stAudio')
      .should('have.attr', 'src')
  })
})
