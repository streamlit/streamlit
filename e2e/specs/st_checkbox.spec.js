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

describe("st.checkbox", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  it("shows widget correctly", () => {
    cy.get(".stCheckbox").should("have.length", 4);

    cy.get(".stCheckbox").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("checkbox" + idx);
    });
  });

  // We have to manually use the changeTheme command in the next two tests
  // since changing the theme between snapshots using the matchThemedSnapshots
  // command will unfocus the widget we're trying to take a snapshot of.
  xit("shows focused widget correctly in dark mode", () => {
    cy.changeTheme("Dark");

    cy.get(".stCheckbox")
      .first()
      // For whatever reason both click() and click({ force: true }) don't want
      // to work here, so we use {multiple: true} even though we only take a
      // snapshot of one of the checkboxes below.
      .click({ multiple: true });

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "value 1: False")
      .then(() => {
        return cy
          .get(".stCheckbox")
          .first()
          .matchImageSnapshot("checkbox-focused-dark");
      });
  });

  xit("shows focused widget correctly in light mode", () => {
    cy.changeTheme("Light");

    cy.get(".stCheckbox")
      .first()
      .click({ multiple: true });

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "value 1: False")
      .then(() => {
        return cy
          .get(".stCheckbox")
          .first()
          .matchImageSnapshot("checkbox-focused");
      });
  });

  it("has correct initial values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      "value 1: True" +
        "value 2: False" +
        "value 3: False" +
        "value 4: False" +
        "checkbox clicked: False"
    );
  });

  it("sets value correctly when user clicks", () => {
    cy.get(".stCheckbox").click({ multiple: true });

    cy.get(".stMarkdown").should(
      "have.text",
      "value 1: False" +
        "value 2: True" +
        "value 3: True" +
        "value 4: True" +
        "checkbox clicked: True"
    );
  });
});
