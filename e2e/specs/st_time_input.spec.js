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

describe("st.time_input", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
    cy.prepForElementSnapshots();
  });

  it("shows labels", () => {
    cy.get(".stTimeInput label").should(
      "have.text",
      "Label 1" +
      "Label 2" +
      "Label 3" +
      "Label 4" +
      "Label 5" +
      "Label 6"
    );
  });

  it("has correct values", () => {
    cy.get(".stMarkdown").should(
      "contain.text",
      "Value 1: 08:45:00" +
      "Value 2: 21:15:00" +
      "Value 3: 08:45:00" +
      "Value 4: 08:45:00" +
      "Value 5: 08:45:00"
    );
  });

  it("shows disabled widget correctly", () => {
    cy.getIndexed(".stTimeInput", 2).matchThemedSnapshots(
      "disabled time input"
    );
  });

  it("looks right when label hidden", () => {
    cy.getIndexed(".stTimeInput", 3).matchThemedSnapshots(
      "hidden-label-time-input"
    );
  });

  it("looks right when label collapsed", () => {
    cy.getIndexed(".stTimeInput", 4).matchThemedSnapshots(
      "collapsed-label-time-input"
    );
  });

  it("handles value changes", () => {
    // open time picker
    cy.get(".stTimeInput")
      .first()
      .click();

    // select '00:00'
    cy.get('[data-baseweb="menu"] [role="option"]')
      .first()
      .click();

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "Value 1: 00:00:00");
  });

  it("allows creatable values", () => {
    cy.get(".stTimeInput input")
      .first()
      .type("1:11");

    cy.get("li")
      .first()
      .click();

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "Value 1: 01:11:00");
  });

  it("calls callback if one is registered", () => {
    cy.get(".stMarkdown")
      .last()
      .should("have.text", "time input changed: False");

    cy.get(".stTimeInput")
      .last()
      .click();

    cy.get('[data-baseweb="menu"] [role="option"]')
      .first()
      .click();

    cy.get(".stMarkdown")
      .last()
      .should("have.text", "time input changed: True");
  });
});
