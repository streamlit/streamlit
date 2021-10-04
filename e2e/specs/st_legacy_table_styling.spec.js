/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

describe("st._legacy_table styling", () => {
  before(() => {
    cy.visit("http://localhost:3000/");

    cy.get("[data-testid='stTable']").should("have.length", 4);

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  it("displays unstyled table", () => {
    cy.get("[data-testid='stTable']")
      .eq(0)
      .find("table tbody tr td")
      .eq(0)
      .should("contain", "1");

    cy.get("[data-testid='stTable']")
      .eq(0)
      .matchThemedSnapshots("legacy-table-unstyled");
  });

  it("displays table with custom formatted cells", () => {
    cy.get("[data-testid='stTable']")
      .eq(1)
      .find("table tbody tr td")
      .eq(0)
      .should("contain", "100.00%");

    cy.get("[data-testid='stTable']")
      .eq(1)
      .matchThemedSnapshots("legacy-table-formatted-cells");
  });

  it("displays table with colored cells", () => {
    cy.get("[data-testid='stTable']")
      .eq(2)
      .find("table tbody tr")
      .eq(0)
      .find("td")
      .each((el, i) => {
        if (i < 3) {
          return cy.wrap(el).should("have.css", "color", "rgb(0, 0, 0)");
        } else {
          return cy.wrap(el).should("have.css", "color", "rgb(255, 0, 0)");
        }
      });

    cy.get("[data-testid='stTable']")
      .eq(2)
      .matchThemedSnapshots("legacy-table-colored-cells");
  });

  it("displays table with differently styled rows", () => {
    cy.get("[data-testid='stTable']")
      .eq(3)
      .find("table tbody tr")
      .should("have.length", 10);

    cy.get("[data-testid='stTable']")
      .eq(3)
      .find("table tbody tr")
      .eq(0)
      .find("td")
      .eq(0)
      .should("have.css", "color", "rgb(124, 252, 0)");

    cy.get("[data-testid='stTable']")
      .eq(3)
      .find("table tbody tr")
      .eq(5)
      .find("td")
      .eq(0)
      .should("have.css", "color", "rgb(0, 0, 0)");

    cy.get("[data-testid='stTable']")
      .eq(3)
      .matchThemedSnapshots("legacy-table-styled-rows");
  });
});
