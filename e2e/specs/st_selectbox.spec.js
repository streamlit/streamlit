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

describe("st.selectbox", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  it("shows widget correctly", () => {
    cy.get(".stSelectbox").should("have.length", 5);

    cy.get(".stSelectbox").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("selectbox" + idx);
    });
  });

  it("has correct initial values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      "value 1: female" +
        "value 2: male" +
        "value 3: None" +
        "value 4: e2e/scripts/components_iframe.py" +
        "value 5: female" +
        "select box changed: False"
    );
  });

  it("formats display values", () => {
    cy.get(".stSelectbox div[aria-selected]")
      .eq(1)
      .should("have.text", "Male");
  });

  it("handles no options", () => {
    cy.get(".stSelectbox div[aria-selected]")
      .eq(2)
      .should("have.text", "No options to select.");

    cy.get(".stSelectbox input")
      .eq(2)
      .should("be.disabled");
  });

  it("sets value correctly when user clicks", () => {
    cy.get(".stSelectbox")
      .eq(1)
      .then(el => {
        cy.wrap(el)
          .find("input")
          .click();
        cy.get("li")
          .last()
          .click();
      });

    cy.get(".stMarkdown").should(
      "have.text",
      "value 1: female" +
        "value 2: female" +
        "value 3: None" +
        "value 4: e2e/scripts/components_iframe.py" +
        "value 5: female" +
        "select box changed: False"
    );
  });

  it("shows the correct options when fuzzy search is applied", () => {
    function typeText(string) {
      cy.get(".stSelectbox")
        .eq(3)
        .then(el => {
          cy.wrap(el)
            .find("input")
            .click()
            .clear()
            .type(string);
        });
    }

    function assertOptionsEquals(options) {
      cy.get("li")
        .should("have.length", options.length)
        .each(($el, index) => {
          cy.wrap($el).should("have.text", options[index]);
        });
    }

    typeText("esstm");
    assertOptionsEquals([
      "e2e/scripts/st_markdown.py",
      "e2e/scripts/st_dataframe_sort_column.py",
      "e2e/scripts/st_experimental_get_query_params.py",
      "e2e/scripts/components_iframe.py"
    ]);

    typeText("eseg");
    assertOptionsEquals(["e2e/scripts/st_experimental_get_query_params.py"]);
  });

  it("calls callback if one is registered", () => {
    cy.get(".stSelectbox")
      .last()
      .then(el => {
        cy.wrap(el)
          .find("input")
          .click();
        cy.get("li")
          .first()
          .click();
      });

    cy.get(".stMarkdown").should(
      "have.text",
      "value 1: female" +
        "value 2: male" +
        "value 3: None" +
        "value 4: e2e/scripts/components_iframe.py" +
        "value 5: male" +
        "select box changed: True"
    );
  });
});
