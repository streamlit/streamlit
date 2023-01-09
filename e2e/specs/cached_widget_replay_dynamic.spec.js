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

describe("dynamic widget replay", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("interaction with a new widget still works", () => {
    cy.get(".stCheckbox").should("have.length", 1)
    cy.get("[data-testid='stText']").first().should("have.text", "['foo']")

    // check checkbox, verify multiselect renders and affects output
    cy.get(".stCheckbox")
      .first()
      .click({ multiple: true });
    cy.get(".stMultiSelect").should("have.length", 1)
    cy.get("[data-testid='stText']").first().should("have.text", "[]")

    // selecting option in multiselect works
    cy.getIndexed(".stMultiSelect", 0).find("div[data-baseweb='select']").click();
    cy.getIndexed("li", 2).click();
    cy.get("[data-testid='stText']").first().should("have.text", "['baz']")

    // uncheck checkbox for testing missing widget
    cy.get(".stCheckbox")
      .first()
      .click({ multiple: true });
    cy.get(".stButton")
      .first().click();
    cy.getIndexed("[data-testid='stText']", 0).should("have.text", "['foo']")
  });

})
