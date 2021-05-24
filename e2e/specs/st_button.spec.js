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

describe("st.button", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  it("shows widget correctly", () => {
    cy.get(".stButton").should("have.length", 1);

    cy.get(".stButton").matchThemedSnapshots("button-widget");
  });

  it("has correct default value", () => {
    cy.get(".stMarkdown").contains("value: False");
    cy.get(".stMarkdown").contains("value from state: False");
  });

  it("sets value correctly when user clicks", () => {
    cy.get(".stButton button").click();

    cy.get(".stMarkdown").contains("value: True");
    cy.get(".stMarkdown").contains("value from state: True");
  });

  it("doesn't reset the value when user clicks again", () => {
    cy.get(".stButton button")
      .click()
      .click();

    cy.get(".stMarkdown").contains("value: True");
  });

  it("calls callback when clicked", () => {
    cy.get(".stMarkdown").contains("Button was clicked: False");

    cy.get(".stButton button").click();

    cy.get(".stMarkdown").contains("Button was clicked: True");
    cy.get(".stMarkdown").contains("times clicked: 1");
    cy.get(".stMarkdown").contains("arg value: 1");
    cy.get(".stMarkdown").contains("kwarg value: 2");

    cy.get(".stButton button").click();
    cy.get(".stMarkdown").contains("times clicked: 2");

    cy.get(".stButton button").click();
    cy.get(".stMarkdown").contains("times clicked: 3");
  });

  it("is reset when user changes another widget", () => {
    cy.get(".stButton button").click();
    cy.get(".stMarkdown").contains("value: True");
    cy.get(".stMarkdown").contains("value from state: True");
    cy.get(".stCheckbox").click();

    cy.get(".stMarkdown").contains("value: False");
    cy.get(".stMarkdown").contains("value from state: False");
  });
});
