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

describe("hello", () => {
  before(() => {
    // Increasing timeout since we're waiting for the animation and map to load.
    Cypress.config("defaultCommandTimeout", 30000);
    cy.visit("http://localhost:3000/");
  });

  it("displays the welcome message", () => {
    cy.get(".element-container .stMarkdown h1").should(
      "contain",
      "Welcome to Streamlit!"
    );

    cy.get(".streamlit-dialog").should("not.exist");

    cy.get(".stSelectbox").should("exist");

    cy.get(".reportview-container").matchThemedSnapshots("welcome-streamlit");
  });

  it("displays animation demo", () => {
    cy.get(".element-container .stSelectbox")
      .click()
      .then(() => {
        cy.get("ul li:nth-child(2)")
          .last()
          .click()
          .then(() => {
            cy.get(".element-container .stMarkdown h1").should(
              "contain",
              "Animation Demo"
            );

            // Wait for the animation to end.
            cy.get(".stButton button").contains("Re-run");

            cy.get(".reportview-container").matchThemedSnapshots(
              "animation-demo"
            );
          });
      });
  });

  it("displays plotting demo", () => {
    cy.get(".element-container .stSelectbox")
      .click()
      .then(() => {
        cy.get("ul li:nth-child(3)")
          .last()
          .click()
          .then(() => {
            cy.get(".element-container .stMarkdown h1").should(
              "contain",
              "Plotting Demo"
            );

            // Wait for the animation to end.
            cy.get("[data-testid='stText']").contains("100% Complete");

            cy.get(".element-container [data-testid='stArrowVegaLiteChart']")
              .find("canvas")
              .should("have.css", "height", "300px");
          });
      });
  });

  it("displays mapping demo", () => {
    cy.get(".element-container .stSelectbox")
      .click()
      .then(() => {
        cy.get("ul li:nth-child(4)")
          .click()
          .then(() => {
            cy.get(".element-container .stMarkdown h1").should(
              "contain",
              "Mapping Demo"
            );

            cy.get(".element-container .stDeckGlJsonChart")
              .find("canvas")
              .should("have.css", "height", "500px");

            // Wait for Mapbox to build the canvas.
            cy.wait(5000);

            cy.get(".reportview-container").matchThemedSnapshots(
              "mapping-demo"
            );
          });
      });
  });

  it("displays dataframe demo", () => {
    cy.get(".element-container .stSelectbox")
      .click()
      .then(() => {
        cy.get("ul li:nth-child(5)")
          .click()
          .then(() => {
            cy.get(".element-container .stMarkdown h1").should(
              "contain",
              "DataFrame Demo"
            );

            cy.get(".stMultiSelect").should("exist");

            cy.get(".stDataFrame").should("exist");

            cy.get(".element-container [data-testid='stArrowVegaLiteChart']")
              .find("canvas")
              .should("have.css", "height", "300px");

            cy.get(".reportview-container").matchThemedSnapshots(
              "dataframe-demo"
            );
          });
      });
  });
});
