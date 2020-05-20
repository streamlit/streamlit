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
      "Label 1" + "Label 2" + "Label 3"
    );
  });

  it("has correct values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: (datetime.date(1970, 1, 1), datetime.date(1970, 1, 1))" +
        "Value 2: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 6))" +
        "Value 3: (datetime.date(2019, 7, 6), datetime.date(2019, 8, 6))"
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
      "Value 1: (datetime.date(1970, 1, 2),)" +
        "Value 2: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 6))" +
        "Value 3: (datetime.date(2019, 7, 6), datetime.date(2019, 8, 6))"
    );

    // select '1970/01/03'
    cy.get(
      '[data-baseweb="calendar"] [aria-label^="Choose Saturday, January 3rd 1970."]'
    ).click();

    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: (datetime.date(1970, 1, 2), datetime.date(1970, 1, 3))" +
        "Value 2: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 6))" +
        "Value 3: (datetime.date(2019, 7, 6), datetime.date(2019, 8, 6))"
    );
  });
});
