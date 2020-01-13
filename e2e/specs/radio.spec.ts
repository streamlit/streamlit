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

describe("st.radio", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get(".decoration").invoke("css", "display", "none");
  });

  it("shows widget correctly", () => {
    cy.get(".stRadio").should("have.length", 3);

    cy.get(".stRadio").each((el, idx) => {
      return cy.wrap(el).matchImageSnapshot("radio" + idx);
    });
  });

  it("has correct initial values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      "value 1: male" + "value 2: female" + "value 3: None"
    );
  });

  it("formats display values", () => {
    cy.get('.stRadio [role="radiogroup"]')
      .eq(1)
      .should("have.text", "FemaleMale");
  });

  it("handles no options", () => {
    cy.get('.stRadio [role="radiogroup"]')
      .eq(2)
      .should("have.text", "No options to select.");

    cy.get('.stRadio [role="radiogroup"]')
      .eq(2)
      .get("input")
      .should("be.disabled");
  });

  it("sets value correctly when user clicks", () => {
    cy.get(".stRadio").each((el, idx) => {
      return cy
        .wrap(el)
        .find("input")
        .last()
        .click({ force: true });
    });

    cy.get(".stMarkdown").should(
      "have.text",
      "value 1: male" + "value 2: male" + "value 3: None"
    );
  });
});
