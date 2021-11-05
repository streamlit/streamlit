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

describe("st.text_input", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  it("shows widget correctly", () => {
    cy.get(".stTextInput").should("have.length", 6);

    cy.get(".stTextInput").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("text_input" + idx);
    });
  });

  it("has correct default values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: "  "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: "  "' +
        "text input changed: False"
    );
  });

  it("sets value correctly when user types", () => {
    cy.get(".stTextInput input")
      .first()
      .type("test input{ctrl}{enter}");

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " test input "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: "  "' +
        "text input changed: False"
    );
  });

  it("sets value correctly on enter keypress", () => {
    cy.get(".stTextInput input")
      .first()
      .type("test input{enter}");

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " test input "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: "  "' +
        "text input changed: False"
    );
  });

  it("sets value correctly on blur", () => {
    cy.get(".stTextInput input")
      .first()
      .type("test input")
      .blur();

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " test input "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: "  "' +
        "text input changed: False"
    );
  });

  it("calls callback if one is registered", () => {
    cy.get(".stTextInput input")
      .last()
      .type("test input")
      .blur();

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: "  "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: " test input "' +
        "text input changed: True"
    );
  });
});
