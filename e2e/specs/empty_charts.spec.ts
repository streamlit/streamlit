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

describe("handles empty charts", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("gracefully handles no data", () => {
    // vega lite
    cy.get(".element-container .stVegaLiteChart").each((el, i) => {
      cy.get(el).matchImageSnapshot(`stVegaLiteChart-${i}`);
    });

    // pyplot
    cy.get(".stImage > img").should("have.attr", "src");

    // BUG https://github.com/cypress-io/cypress/issues/4322
    // cy.get('.stDeckGlChart canvas')
    //  .should('exist')
  });

  it("handles no data with exception", () => {
    cy.get(".stException .message")
      .eq(0)
      .should(
        "have.text",
        "ValueError: Vega-Lite charts require a non-empty spec dict."
      );

    cy.get(".stException .message")
      .eq(1)
      .should(
        "have.text",
        "ValueError: Vega-Lite charts require a non-empty spec dict."
      );

    cy.get(".stException .message")
      .eq(2)
      .should(
        "have.text",
        "ValueError: Vega-Lite charts require a non-empty spec dict."
      );

    cy.get(".stException .message")
      .eq(3)
      .should(
        "have.text",
        "ValueError: Vega-Lite charts require a non-empty spec dict."
      );

    cy.get(".stException .message")
      .eq(4)
      .should(
        "have.text",
        "TypeError: altair_chart() missing 1 required positional argument: 'altair_chart'"
      );

    cy.get(".stException .message")
      .eq(5)
      .should(
        "have.text",
        "TypeError: map() missing 1 required positional argument: 'data'"
      );
  });
});
