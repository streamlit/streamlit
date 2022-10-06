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

describe("st.text_area", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("shows widget correctly", () => {
    cy.get(".stTextArea").should("have.length", 10);

    cy.get(".stTextArea").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("text_area" + idx);
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
        'value 7: " default text "' +
        'value 8: " default text "' +
        'value 9: " default text "' +
        'value 10: "  "' +
        "text area changed: False"
    );
  });

  it("sets value correctly when user types", () => {
    cy.get(".stTextArea textarea")
      .first()
      .type("test area{ctrl}{enter}");

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " test area "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: "  "' +
        'value 7: " default text "' +
        'value 8: " default text "' +
        'value 9: " default text "' +
        'value 10: "  "' +
        "text area changed: False"
    );
  });

  it("sets value correctly on ctrl-enter keypress", () => {
    cy.get(".stTextArea textarea")
      .first()
      .type("test area{ctrl}{enter}");

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " test area "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: "  "' +
        'value 7: " default text "' +
        'value 8: " default text "' +
        'value 9: " default text "' +
        'value 10: "  "' +
        "text area changed: False"
    );
  });

  it("sets value correctly on command-enter keypress", () => {
    cy.get(".stTextArea textarea")
      .first()
      .type("test area{command}{enter}");

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " test area "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: "  "' +
        'value 7: " default text "' +
        'value 8: " default text "' +
        'value 9: " default text "' +
        'value 10: "  "' +
        "text area changed: False"
    );
  });

  it("sets value correctly on blur", () => {
    cy.get(".stTextArea textarea")
      .first()
      .type("test area")
      .blur();

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " test area "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: "  "' +
        'value 7: " default text "' +
        'value 8: " default text "' +
        'value 9: " default text "' +
        'value 10: "  "' +
        "text area changed: False"
    );
  });

  it("sets value correctly with max_chars enabled", () => {
    cy.getIndexed(".stTextArea textarea", 4)
      .type("test area! this shouldn't be returned")
      .blur();

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: "  "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: " test area! "' +
        'value 6: "  "' +
        'value 7: " default text "' +
        'value 8: " default text "' +
        'value 9: " default text "' +
        'value 10: "  "' +
        "text area changed: False"
    );
  });

  it("calls callback if one is registered", () => {
    cy.get(".stTextArea textarea")
      .last()
      .type("text area!")
      .blur();

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: "  "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: "  "' +
        'value 7: " default text "' +
        'value 8: " default text "' +
        'value 9: " default text "' +
        'value 10: " text area! "' +
        "text area changed: True"
    );
  });
});
