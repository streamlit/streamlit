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

describe("st.error and friends", () => {
  before(() => {
    cy.visit("http://localhost:3000/");

    // Wait for the "Please, wait" alert to disappear.
    cy.get(
      ".element-container .stAlert [data-testid='stMarkdownContainer']"
    ).should("have.length", 4);
  });

  it("displays an error message correctly", () => {
    cy.get(".element-container .stAlert [data-testid='stMarkdownContainer']")
      .eq(0)
      .contains("This is an error");
  });

  it("displays a warning message correctly", () => {
    cy.get(".element-container .stAlert [data-testid='stMarkdownContainer']")
      .eq(1)
      .contains("This is a warning");
  });

  it("displays an info message correctly", () => {
    cy.get(".element-container .stAlert [data-testid='stMarkdownContainer']")
      .eq(2)
      .contains("This is an info message");
  });

  it("displays a success message correctly", () => {
    cy.get(".element-container .stAlert [data-testid='stMarkdownContainer']")
      .eq(3)
      .contains("This is a success message");
  });

  it("matches the snapshot", () => {
    cy.get(".main > .block-container").matchThemedSnapshots("alerts");
  });
});
