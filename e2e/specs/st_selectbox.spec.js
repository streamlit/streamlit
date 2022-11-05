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

describe("st.selectbox", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("shows widget correctly", () => {
    cy.get(".stSelectbox").should("have.length", 9);

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
        "value 5: male" +
        "value 6: male" +
        "value 7: male" +
        "value 8: female" +
        "select box changed: False"
    );
  });

  it("formats display values", () => {
    cy.getIndexed(".stSelectbox div", 3).should(
      "have.text",
      "female"
    );
  });

  it("handles no options", () => {
    cy.getIndexed(".stSelectbox div", 17).should(
      "have.text",
      "No options to select."
    );

    cy.getIndexed(".stSelectbox input", 2).should("be.disabled");
  });

  it("sets value correctly when user clicks", () => {
    cy.getIndexed(".stSelectbox", 1).then(el => {
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
        "value 5: male" +
        "value 6: male" +
        "value 7: male" +
        "value 8: female" +
        "select box changed: False"
    );
  });

  it("shows the correct options when fuzzy search is applied", () => {
    function typeText(string) {
      cy.getIndexed(".stSelectbox", 3).then(el => {
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
    cy.getIndexed(".stSelectbox", 7).then(el => {
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
        "value 6: male" +
        "value 7: male" +
        "value 8: male" +
        "select box changed: True"
    );
  });
});
