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

describe("st.form", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    // Just adding an alias to markdown containers that are below the form.
    cy.get(
      "[data-testid='stForm'] ~ .element-container [data-testid='stMarkdownContainer']"
    ).as("markdown");
    cy.get("@markdown").should("have.length", 12);
  });

  it("doesn't change widget values before the form is submitted", () => {
    changeWidgetValues();

    cy.getIndexed("@markdown", 0).should("have.text", "Checkbox: False");
    cy.getIndexed("@markdown", 1).should("have.text", "Color Picker: #000000");
    cy.getIndexed("@markdown", 2).should(
      "have.text",
      "Date Input: 2019-07-06"
    );
    cy.getIndexed("@markdown", 3).should("have.text", "Multiselect: foo");
    cy.getIndexed("@markdown", 4).should("have.text", "Number Input: 0.0");
    cy.getIndexed("@markdown", 5).should("have.text", "Radio: foo");
    cy.getIndexed("@markdown", 6).should("have.text", "Selectbox: foo");
    cy.getIndexed("@markdown", 7).should("have.text", "Select Slider: foo");
    cy.getIndexed("@markdown", 8).should("have.text", "Slider: 0");
    cy.getIndexed("@markdown", 9).should("have.text", "Text Area: foo");
    cy.getIndexed("@markdown", 10).should("have.text", "Text Input: foo");
    cy.getIndexed("@markdown", 11).should("have.text", "Time Input: 08:45:00");
  });

  it("changes widget values after the form has been submitted", () => {
    changeWidgetValues();
    cy.get(".stButton [kind='formSubmit']").click();
    cy.get("@markdown").should("have.length", 12);

    cy.getIndexed("@markdown", 0).should("have.text", "Checkbox: True");
    // Cypress has a weird issue with Chrome's color picker.
    // Commenting out the check for color picker value before we find a solution.
    // cy.getIndexed("@markdown", 1)
    //   .should("have.text", "Color Picker: #ff0000");
    cy.getIndexed("@markdown", 2).should(
      "have.text",
      "Date Input: 2019-07-17"
    );
    cy.getIndexed("@markdown", 3).should("have.text", "Multiselect: foo, bar");
    cy.getIndexed("@markdown", 4).should("have.text", "Number Input: 42.0");
    cy.getIndexed("@markdown", 5).should("have.text", "Radio: bar");
    cy.getIndexed("@markdown", 6).should("have.text", "Selectbox: bar");
    cy.getIndexed("@markdown", 7).should("have.text", "Select Slider: bar");
    cy.getIndexed("@markdown", 8).should("have.text", "Slider: 1");
    cy.getIndexed("@markdown", 9).should("have.text", "Text Area: bar");
    cy.getIndexed("@markdown", 10).should("have.text", "Text Input: bar");
    cy.getIndexed("@markdown", 11).should("have.text", "Time Input: 00:00:00");
  });
});

function changeWidgetValues() {
  // Change the checkbox value.
  cy.get(".stCheckbox").click();

  // Change the color picker value.
  cy.get("[data-testid='stColorPicker'] > div").click();
  cy.get(".chrome-picker input")
    .clear()
    .type("#FF0000");

  // Change the date input value.
  cy.get(".stDateInput").click();
  cy.get(
    '[data-baseweb="calendar"] [aria-label^="Choose Wednesday, July 17th 2019."]'
  ).click();

  // Change the multiselect value.
  cy.get(".stMultiSelect")
    .find("input")
    .click();
  cy.get("[data-baseweb='popover'] li")
    .eq(0)
    .click();

  // Change the number input value.
  cy.get(".stNumberInput input")
    .clear()
    .type("42");

  // Change the radio value.
  cy.getIndexed(".stRadio div label", 1).click();

  // Change the selectbox value.
  cy.get(".stSelectbox")
    .find("input")
    .click();
  cy.getIndexed("[data-baseweb='popover'] li", 1).click();

  // Change the select slider value.
  cy.get('.stSlider [role="slider"]')
    .first()
    .click()
    .type("{rightarrow}", { force: true });

  // Change the slider value.
  cy.get('.stSlider [role="slider"]')
    .last()
    .click()
    .type("{rightarrow}", { force: true });

  // Change the text area value.
  cy.get(".stTextArea textarea")
    .clear()
    .type("bar");

  // Change the text input value.
  cy.get(".stTextInput input")
    .clear()
    .type("bar");

  // Change the time input value.
  cy.get(".stTimeInput").click();
  cy.get('[data-baseweb="menu"] [role="option"]')
    .first()
    .click();
}
