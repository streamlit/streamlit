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

describe("st.date_input", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");
  });

  it("shows labels", () => {
    cy.get(".stDateInput label").should(
      "have.text",
      "Single date" +
        "Single datetime" +
        "Range, no date" +
        "Range, one date" +
        "Range, two dates"
    );
  });

  it("has correct values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: 1970-01-01" +
        "Value 2: 2019-07-06" +
        "Value 3: ()" +
        "Value 4: (datetime.date(2019, 7, 6),)" +
        "Value 5: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 8))"
    );
  });

  it("handles value changes", () => {
    // open date picker
    cy.get(".stDateInput")
      .first()
      .click();

    // select '1970/01/02'
    cy.get(
      '[data-baseweb="calendar"] [aria-label^="Choose Friday, January 2nd 1970."]'
    ).click();

    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: 1970-01-02" +
        "Value 2: 2019-07-06" +
        "Value 3: ()" +
        "Value 4: (datetime.date(2019, 7, 6),)" +
        "Value 5: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 8))"
    );
  });

  it("handles range end date changes", () => {
    // open date picker
    cy.get(".stDateInput")
      .eq(3)
      .click();

    // select end date '2019/07/08'
    cy.get(
      '[data-baseweb="calendar"] [aria-label^="Choose Wednesday, July 10th 2019."]'
    ).click();

    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: 1970-01-01" +
        "Value 2: 2019-07-06" +
        "Value 3: ()" +
        "Value 4: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 10))" +
        "Value 5: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 8))"
    );
  });

  it("handles range start/end date changes", () => {
    // open date picker
    cy.get(".stDateInput")
      .eq(4)
      .click();

    // select start date '2019/07/10'
    cy.get(
      '[data-baseweb="calendar"] [aria-label^="Choose Wednesday, July 10th 2019."]'
    ).click();

    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: 1970-01-01" +
        "Value 2: 2019-07-06" +
        "Value 3: ()" +
        "Value 4: (datetime.date(2019, 7, 6),)" +
        "Value 5: (datetime.date(2019, 7, 10),)"
    );

    // select end date '2019/07/10'
    cy.get(
      '[data-baseweb="calendar"] [aria-label^="Choose Friday, July 12th 2019."]'
    ).click();

    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: 1970-01-01" +
        "Value 2: 2019-07-06" +
        "Value 3: ()" +
        "Value 4: (datetime.date(2019, 7, 6),)" +
        "Value 5: (datetime.date(2019, 7, 10), datetime.date(2019, 7, 12))"
    );
  });
});
