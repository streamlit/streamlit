/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

describe("st.vega_lite_chart", () => {
  before(() => {
    cy.visit("http://localhost:3000/");

    // Force our header to scroll with the page, rather than
    // remaining fixed. This prevents us from occasionally getting
    // the little multi-colored ribbon at the top of our screenshots.
    cy.get(".stApp > header").invoke("css", "position", "absolute");

    // Make the ribbon decoration line disappear
    cy.get(".decoration").invoke("css", "display", "none");
  });

  it("displays charts on the DOM", () => {
    cy.get(".element-container .stVegaLiteChart")
      .find("canvas")
      .should("have.class", "marks");
  });

  it("sets the correct chart width", () => {
    cy.get(".stVegaLiteChart canvas")
      .eq(0)
      .should("have.css", "width", "660px");

    cy.get(".stVegaLiteChart canvas")
      .eq(1)
      .should("have.css", "width", "660px");

    cy.get(".stVegaLiteChart canvas")
      .eq(2)
      .should("have.css", "width")
      .and(width => {
        // Tests run on mac expect 282px while running on linux expects 284px
        if (width != "200px") {
          throw new Error("Expected default width to be 200px. Was: " + width);
        }
      });

    cy.get(".stVegaLiteChart canvas")
      .eq(3)
      .should("have.css", "width", "500px");
  });

  it("supports different ways to get the same plot", () => {
    cy.get(".stVegaLiteChart")
      .filter(idx => idx >= 4 && idx <= 7)
      .each(el => {
        return cy.wrap(el).matchImageSnapshot();
      });
  });
});
