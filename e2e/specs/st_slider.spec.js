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

describe("st.slider", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");
  });

  it("looks right", () => {
    cy.get(".stSlider")
      .first()
      .matchThemedSnapshots("slider");
  });

  it("shows labels", () => {
    cy.get(".stSlider label").should(
      "have.text",
      "Label 1" + "Label 2" + "Label 3"
    );
  });

  it("has correct values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: 25" +
        "Value 2: (25.0, 75.0)" +
        "Value 3: 25" +
        "Slider changed: False"
    );
  });

  it("handles value changes", () => {
    // trigger click in the center of the slider
    cy.get('.stSlider [role="slider"]')
      .first()
      .parent()
      .click();

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "Value 1: 50");
  });

  it("increments the value on right arrow key press", () => {
    cy.get('.stSlider [role="slider"]')
      .first()
      .click()
      .type("{rightarrow}", { force: true });

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "Value 1: 26");
  });

  it("decrements the value on left arrow key press", () => {
    cy.get('.stSlider [role="slider"]')
      .first()
      .click()
      .type("{leftarrow}", { force: true });

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "Value 1: 24");
  });

  it("maintains its state on rerun", () => {
    cy.get('.stSlider [role="slider"]')
      .first()
      .click()
      .type("{leftarrow}", { force: true });

    // Rerun the script.
    cy.get(".stApp [data-testid='stDecoration']").trigger("keypress", {
      keyCode: 82, // "r"
      which: 82 // "r"
    });

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "Value 1: 24");
  });

  it("calls callback if one is registered", () => {
    cy.get(".stMarkdown").should(
      "contain.text",
      "Value 3: 25" + "Slider changed: False"
    );

    cy.get('.stSlider [role="slider"]')
      .last()
      .click()
      .type("{rightarrow}", { force: true });

    cy.get(".stMarkdown").should(
      "contain.text",
      "Value 3: 26" + "Slider changed: True"
    );
  });
});
