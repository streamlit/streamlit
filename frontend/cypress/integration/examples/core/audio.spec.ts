/// <reference types="cypress" />

describe('st.audio', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  it('displays an audio player', () => {
    cy.get('.element-container')
      .find('audio.stAudio')
  })

  it('has controls', () => {
    cy.get('.element-container .stAudio')
      .should('have.attr', 'controls')
  })

  it('has src', () => {
    cy.get('.element-container .stAudio')
      .should('have.attr', 'src')
  })

  it('has audio', () => {
    cy.get('.element-container .stAudio')
      .should('have.prop', 'tagName')
      .and('eq', 'AUDIO')
  })
})
