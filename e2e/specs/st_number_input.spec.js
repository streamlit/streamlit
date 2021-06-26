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

describe("st.number_input", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  it("shows widget correctly", () => {
    cy.get(".stNumberInput").should("have.length", 6);

    cy.get(".stNumberInput").each((el, idx) => {
      // @ts-ignore
      return cy.wrap(el).matchThemedSnapshots("number_input" + idx);
    });
  });

  it("has correct default values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " 0.0 "' +
        'value 2: " 1 "' +
        'value 3: " 1 "' +
        'value 4: " 0 "' +
        'value 5: " 0 "' +
        'value 6: " 0.0 "' +
        "number input changed: False"
    );
  });

  it("displays instructions correctly on change", () => {
    cy.get(".stNumberInput input")
      .first()
      .clear()
      .type("10");

    cy.get(".stNumberInput")
      .first()
      .matchThemedSnapshots("number_input_change", {
        focus: "input"
      });
  });

  it("sets value correctly on enter keypress", () => {
    cy.get(".stNumberInput input")
      .first()
      .clear()
      .type("10{enter}");

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " 10.0 "' +
        'value 2: " 1 "' +
        'value 3: " 1 "' +
        'value 4: " 0 "' +
        'value 5: " 0 "' +
        'value 6: " 0.0 "' +
        "number input changed: False"
    );
  });

  it("sets value correctly on blur", () => {
    cy.get(".stNumberInput input")
      .first()
      .clear()
      .type("10")
      .blur();

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " 10.0 "' +
        'value 2: " 1 "' +
        'value 3: " 1 "' +
        'value 4: " 0 "' +
        'value 5: " 0 "' +
        'value 6: " 0.0 "' +
        "number input changed: False"
    );
  });

  it("has the correct step value when clicked", () => {
    cy.get(".stNumberInput button.step-up").click({ multiple: true });

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " 0.01 "' +
        'value 2: " 2 "' +
        'value 3: " 2 "' +
        'value 4: " 2 "' +
        'value 5: " 1 "' +
        'value 6: " 0.01 "' +
        "number input changed: True"
    );
  });

  it("has the correct step value with keypress", () => {
    cy.get(".stNumberInput input")
      .first()
      .type("{downarrow}");

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " -0.01 "' +
        'value 2: " 1 "' +
        'value 3: " 1 "' +
        'value 4: " 0 "' +
        'value 5: " 0 "' +
        'value 6: " 0.0 "' +
        "number input changed: False"
    );
  });
});
