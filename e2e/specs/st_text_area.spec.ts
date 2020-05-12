/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

/// <reference types="cypress" />

describe("st.text_area", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get(".decoration").invoke("css", "display", "none");
  });

  it("shows widget correctly", () => {
    cy.get(".stTextArea").should("have.length", 5);

    cy.get(".stTextArea").each((el, idx) => {
      return cy.wrap(el).matchImageSnapshot("text_area" + idx);
    });
  });

  it("has correct default values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: "  "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "'
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
        'value 5: "  "'
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
        'value 5: "  "'
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
        'value 5: "  "'
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
        'value 5: "  "'
    );
  });

  it("sets value correctly with max_chars enabled", () => {
    cy.get(".stTextArea textarea")
      .last()
      .type("test area! this shouldn't be returned")
      .blur();

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: "  "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: " test area! "'
    );
  });
});
