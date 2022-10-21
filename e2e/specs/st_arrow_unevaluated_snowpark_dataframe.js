/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

describe("st.DataFrame with unevaluated snowflake.snowpark.dataframe.DataFrame", () => {

  before(() => {
    // Increasing timeout since we're waiting for
    // dataframes, and charts to be rendered.
    var timeout = 300000
    Cypress.config("defaultCommandTimeout", timeout)
    cy.visit("http://localhost:3000/")
    cy.get("[data-testid='stAppViewContainer']", { timeout: timeout }).should(
      "not.contain",
      "Please wait..."
    )
    // Wait until the script is no longer running.
    cy.get("[data-testid='stStatusWidget']", { timeout: timeout }).should(
      "not.exist"
    )
    cy.prepForElementSnapshots();
  });

  it("dataframe exists and is evaluated", () => {
    cy.get(".stDataFrame")
      .should("have.length", 1)
  });

  it("warning about data being capped exists", () => {
    cy.get("div [data-testid='stCaptionContainer']")
      .should("have.length", 4)
  });

  it("warning about data being capped exists", () => {
    cy.getIndexed("div [data-testid='stCaptionContainer']", 0)
      .should("contain", "Showing only 10k rows. Call collect() on the dataframe to show more.")
    cy.getIndexed("div [data-testid='stCaptionContainer']", 1)
      .should("contain", "Showing only 10k rows. Call collect() on the dataframe to show more.")
    cy.getIndexed("div [data-testid='stCaptionContainer']", 2)
      .should("contain", "Showing only 10k rows. Call collect() on the dataframe to show more.")
    cy.getIndexed("div [data-testid='stCaptionContainer']", 3)
      .should("contain", "Showing only 10k rows. Call collect() on the dataframe to show more.")
  });

  it("displays a line chart", () => {
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']")
      .find("canvas")
      .first()
      .should("have.css", "height", "350px");
  });

  it("displays a bar chart", () => {
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']")
      .find("canvas")
      .first()
      .should("have.css", "height", "350px");
  });

  it("displays an area chart", () => {
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']")
      .find("canvas")
      .first()
      .should("have.css", "height", "350px");
  });
});
