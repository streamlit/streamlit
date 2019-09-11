/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/// <reference types="cypress" />

describe('st.multiselectbox', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/')
  })

  describe('when first loaded', () => {
    it('should show widget correctly', () => {
      cy.get('.stMultiselectbox')
        .should('have.length', 3)

      cy.get('.stMultiselectbox')
        .each((el, idx) => {
          cy.wrap(el).matchImageSnapshot('multiselectbox' + idx)
        })
    })

    it('should show the correct text', () => {
      cy.get('.stText')
        .should(
          'have.text',
          'value 1:[]value 2:[]value 3:[]')
    })

    describe('when there are valid options', () => {
      it('should show the correct placeholder', () => {
        cy.get('.stMultiselectbox')
          .first()
          .should(
            'have.text',
            'selectbox 1searchChoose an option')
      })
    })
    describe('when there are no valid options', () => {
      it('should show the correct placeholder', () => {
        cy.get('.stMultiselectbox')
          .last()
          .should(
            'have.text',
            'selectbox 3searchNo options to select.')
      })
    })
  })

  describe('when clicking on the input', () => {
    it('should show values correctly in the dropdown menu', () => {
      cy.get('.stMultiselectbox')
        .eq(0)
        .then((el) => {
          cy.wrap(el)
            .find('input')
            .click()
            .get('li')
            .should('have.length', 2)
            .should('have.text', 'malefemale')
            .each((el, idx) => {
              cy.wrap(el).matchImageSnapshot('multiselectbox-dropdown-' + idx)
            })
        })
    })
  })

  function selectOption(idx) {
    cy.get('.stMultiselectbox')
      .eq(1)
      .find('input')
      .click()
    cy.get('li')
      .eq(idx)
      .click()
  }

  describe('when the user make a selection', () => {
    beforeEach(() => selectOption(1))

    it('sets the value correctly', () => {
      cy.get('.stMultiselectbox span')
        .eq(1)
        .should(
          'have.text',
          'Female')
      cy.get('.stMultiselectbox')
        .eq(1).then(el => {
          cy.wrap(el).matchImageSnapshot('multiselectbox-selection')
        })
    })

    it('outputs the correct value', () => {
      cy.get('.stText')
        .should(
          'have.text',
          'value 1:[]value 2:[0:"female"]value 3:[]')
    })

    describe('when the user picks a second option', () => {
      beforeEach(() => selectOption(0))

      it('outputs the correct value', () => {
        cy.get('.stText')
          .should(
            'have.text',
            'value 1:[]value 2:[0:"female"1:"male"]value 3:[]')
      })

      describe('when the user deselects the first option', () => {
        beforeEach(() => {
          cy.get('[role="button"]')
            .eq(1)  // this is the 'close button' element for 'Male'
            .click()
        })
        it('outputs the correct value', () => {
          cy.get('.stText')
            .should(
              'have.text',
              'value 1:[]value 2:[0:"male"]value 3:[]')
        })
      })

      describe('when the user click the clear button', () => {
        beforeEach(() => {
          cy.get('[role="button"]')
            .eq(4)  // this is the clear button element
            .click()
        })
        it('outputs the correct value', () => {
          cy.get('.stText')
            .should(
              'have.text',
              'value 1:[]value 2:[]value 3:[]')
        })
      })
    })
  })
})
