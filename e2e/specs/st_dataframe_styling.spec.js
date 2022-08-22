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

describe("st.DataFrame style checks w/ canvas rendering", () => {
  before(() => {
    // Increasing timeout since we're waiting for
    // dataframes and tables to be rendered.
    Cypress.config("defaultCommandTimeout", 30000);

    cy.loadApp("http://localhost:3000/");
    cy.prepForElementSnapshots();
  });

  it("Rendering correct number of dataframes", () => {
    cy.get("[data-testid='data-grid-canvas']").should("have.length", 4);
  });

  /*
    Since glide-data-grid uses HTML canvas for rendering the table we
    cannot run any tests based on the HTML DOM. Therefore, we only use snapshot
    matching to test that our table examples render correctly. In addition, glide-data-grid
    itself also has more advanced canvas based tests for some of the interactive features.
  */

  it("Renders dataframe correctly with plaintext styling", () => {
    cy.getIndexed(".stDataFrame", 0).matchThemedSnapshots(
      "data-grid-canvas-0"
    );
  });
  it("Renders dataframe correctly with rgb styling", () => {
    cy.getIndexed(".stDataFrame", 1).matchThemedSnapshots(
      "data-grid-canvas-1"
    );
  });
  it("Renders dataframe correctly with hexadecimal styling", () => {
    cy.getIndexed(".stDataFrame", 2).matchThemedSnapshots(
      "data-grid-canvas-2"
    );
  });
  it("Renders dataframe correctly with hsl styling", () => {
    cy.getIndexed(".stDataFrame", 3).matchThemedSnapshots(
      "data-grid-canvas-3"
    );
  });
});
