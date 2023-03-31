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

describe("st.error and friends", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    // Wait for the "Please, wait" alert to disappear.
    cy.get(".element-container .stAlert").should("have.length", 14);
  });

  it("displays an error message correctly", () => {
    cy.getIndexed(".element-container .stAlert", 0)
      .get("[data-testid='stMarkdownContainer']")
      .contains("This is an error");
  });

  it("displays a warning message correctly", () => {
    cy.getIndexed(".element-container .stAlert", 1)
      .get("[data-testid='stMarkdownContainer']")
      .contains("This is a warning");
  });

  it("displays an info message correctly", () => {
    cy.getIndexed(".element-container .stAlert", 2)
      .get("[data-testid='stMarkdownContainer']")
      .contains("This is an info message");
  });

  it("displays a success message correctly", () => {
    cy.getIndexed(".element-container .stAlert", 3)
      .get("[data-testid='stMarkdownContainer']")
      .contains("This is a success message");
  });

  it("displays code blocks with long lines correctly", () => {
    cy.getIndexed(".element-container .stAlert", 9)
      .get("[data-testid='stMarkdownContainer']")
      .contains("Here is some code:")
  });

  it("matches snapshots", () => {
    // Individual snapshots
    cy.get(".stAlert").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("alert" + idx);
    });

    // All alerts (to test spacing between alerts and elements above/below them)
    // Note that this snapshot gets cut off in CI due to there being too many
    // alerts to all fit on screen at once, but that doesn't particularly matter.
    cy.get(".main > .block-container").matchThemedSnapshots("alert-spacing");
  });
});
