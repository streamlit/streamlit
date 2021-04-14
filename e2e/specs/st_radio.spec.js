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

describe("st.radio", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  it("shows widget correctly", () => {
    cy.get(".stRadio").should("have.length", 3);

    cy.get(".stRadio").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("radio" + idx);
    });
  });

  // We have to manually use the changeTheme command in the next two tests
  // since changing the theme between snapshots using the matchThemedSnapshots
  // command will unfocus the widget we're trying to take a snapshot of.
  it("shows focused widget correctly in dark mode", () => {
    cy.changeTheme("Dark");

    cy.get(".stRadio")
      .first()
      .find("input")
      .first()
      .click({ force: true })
      .then(() => {
        return cy
          .get(".stRadio")
          .first()
          .matchImageSnapshot("radio-focused-dark");
      });

    cy.get(".stMarkdown")
      .should(
        "have.text",
        "value 1: female" + "value 2: female" + "value 3: None"
      )
      .then(() => {
        return cy
          .get(".stRadio")
          .first()
          .matchImageSnapshot("radio-focused-dark");
      });
  });

  it("shows focused widget correctly in light mode", () => {
    cy.changeTheme("Light");

    cy.get(".stRadio")
      .first()
      .find("input")
      .first()
      .click({ force: true });

    cy.get(".stMarkdown")
      .should(
        "have.text",
        "value 1: female" + "value 2: female" + "value 3: None"
      )
      .then(() => {
        return cy
          .get(".stRadio")
          .first()
          .matchImageSnapshot("radio-focused");
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
