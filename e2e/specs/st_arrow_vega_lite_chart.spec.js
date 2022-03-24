/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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

describe("st._arrow_vega_lite_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays charts on the DOM", () => {
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']")
      .find("canvas")
      .should("have.class", "marks");
  });

  it("sets the correct chart width", () => {
    cy.getIndexed("[data-testid='stArrowVegaLiteChart'] canvas", 0).should(
      "have.css",
      "width",
      "666px"
    );

    cy.getIndexed("[data-testid='stArrowVegaLiteChart'] canvas", 1).should(
      "have.css",
      "width",
      "666px"
    );

    cy.getIndexed("[data-testid='stArrowVegaLiteChart'] canvas", 2)
      .should("have.css", "width")
      .and(width => {
        // Tests run on mac expect 282px while running on linux expects 284px
        if (width != "200px") {
          throw new Error("Expected default width to be 200px. Was: " + width);
        }
      });

    cy.getIndexed("[data-testid='stArrowVegaLiteChart'] canvas", 3).should(
      "have.css",
      "width",
      "500px"
    );
  });

  it("supports different ways to get the same plot", () => {
    cy.get("[data-testid='stArrowVegaLiteChart']")
      .filter(idx => idx >= 4 && idx <= 7)
      .each((el, idx) => {
        return cy.wrap(el).matchThemedSnapshots(`arrow_vega_lite_chart${idx}`);
      });
  });
});
