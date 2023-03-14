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

describe("st.date_input", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
    cy.prepForElementSnapshots();
  });

  it("shows labels", () => {
    cy.get(".stDateInput label").should(
      "have.text",
      "Single date" +
        "Single datetime" +
        "Range, no date" +
        "Range, one date" +
        "Range, two dates" +
        "Disabled, no date" +
        "Label hidden" +
        "Label collapsed" +
        "Single date with callback"
    );
  });

  it("shows widget correctly", () => {
    cy.get(".stDateInput").should("have.length", 9);

    cy.get(".stDateInput").each((el, idx) => {
      // @ts-expect-error
      return cy.wrap(el).matchThemedSnapshots("date_input" + idx);
    });
  });

  it("has correct values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: 1970-01-01" +
        "Value 2: 2019-07-06" +
        "Value 3: ()" +
        "Value 4: (datetime.date(2019, 7, 6),)" +
        "Value 5: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 8))" +
        "Value 6: ()" +
        "Value 7: 2019-07-06" +
        "Value 8: 2019-07-06" +
        "Value 9: 1970-01-01" +
        "Date Input Changed: False"
    );
  });

  it("shows disabled widget correctly", () => {
    cy.getIndexed(".stDateInput", 5).matchThemedSnapshots(
      "disabled date input"
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
        "Value 5: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 8))" +
        "Value 6: ()" +
        "Value 7: 2019-07-06" +
        "Value 8: 2019-07-06" +
        "Value 9: 1970-01-01" +
        "Date Input Changed: False"
    );
  });

  it("handles range end date changes", () => {
    // open date picker
    cy.getIndexed(".stDateInput", 3).click();

    // select end date '2019/07/10'
    cy.get(
      '[data-baseweb="calendar"] [aria-label^="Choose Wednesday, July 10th 2019."]'
    ).click();

    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: 1970-01-01" +
        "Value 2: 2019-07-06" +
        "Value 3: ()" +
        "Value 4: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 10))" +
        "Value 5: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 8))" +
        "Value 6: ()" +
        "Value 7: 2019-07-06" +
        "Value 8: 2019-07-06" +
        "Value 9: 1970-01-01" +
        "Date Input Changed: False"
    );
  });

  it("handles range start/end date changes", () => {
    // open date picker
    cy.getIndexed(".stDateInput", 4).click();

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
        "Value 5: (datetime.date(2019, 7, 10),)" +
        "Value 6: ()" +
        "Value 7: 2019-07-06" +
        "Value 8: 2019-07-06" +
        "Value 9: 1970-01-01" +
        "Date Input Changed: False"
    );

    // select end date '2019/07/12'
    cy.get(
      '[data-baseweb="calendar"] [aria-label^="Choose Friday, July 12th 2019."]'
    ).click();

    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: 1970-01-01" +
        "Value 2: 2019-07-06" +
        "Value 3: ()" +
        "Value 4: (datetime.date(2019, 7, 6),)" +
        "Value 5: (datetime.date(2019, 7, 10), datetime.date(2019, 7, 12))" +
        "Value 6: ()" +
        "Value 7: 2019-07-06" +
        "Value 8: 2019-07-06" +
        "Value 9: 1970-01-01" +
        "Date Input Changed: False"
    );
  });

  it("calls callback if one is registered", () => {
    cy.get(".stMarkdown").should(
      "contain.text",
      "Value 9: 1970-01-01" + "Date Input Changed: False"
    );

    cy.get(".stDateInput")
      .last()
      .click();

    cy.get(
      '[data-baseweb="calendar"] [aria-label^="Choose Friday, January 2nd 1970."]'
    ).click();

    cy.get(".stMarkdown").should(
      "contain.text",
      "Value 9: 1970-01-02" + "Date Input Changed: True"
    );
  });

  it("reset to default single value if calendar closed empty", () => {
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
        "Value 5: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 8))" +
        "Value 6: ()" +
        "Value 7: 2019-07-06" +
        "Value 8: 2019-07-06" +
        "Value 9: 1970-01-01" +
        "Date Input Changed: False"
    );

    // remove input
    cy.get(".stDateInput")
      .first()
      .click()
      .type("{del}{selectall}{backspace}");

    // click outside of date input
    cy.contains("Single date").click();

    // value should be reset to 1970-01-01
    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: 1970-01-01" +
        "Value 2: 2019-07-06" +
        "Value 3: ()" +
        "Value 4: (datetime.date(2019, 7, 6),)" +
        "Value 5: (datetime.date(2019, 7, 6), datetime.date(2019, 7, 8))" +
        "Value 6: ()" +
        "Value 7: 2019-07-06" +
        "Value 8: 2019-07-06" +
        "Value 9: 1970-01-01" +
        "Date Input Changed: False"
    );
  });

  it("not reset to default range value if calendar closed empty", () => {
    // open date picker
    cy.getIndexed(".stDateInput", 4).click();

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
        "Value 5: (datetime.date(2019, 7, 10),)" +
        "Value 6: ()" +
        "Value 7: 2019-07-06" +
        "Value 8: 2019-07-06" +
        "Value 9: 1970-01-01" +
        "Date Input Changed: False"
    );

    // select end date '2019/07/12'
    cy.get(
      '[data-baseweb="calendar"] [aria-label^="Choose Friday, July 12th 2019."]'
    ).click();

    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: 1970-01-01" +
        "Value 2: 2019-07-06" +
        "Value 3: ()" +
        "Value 4: (datetime.date(2019, 7, 6),)" +
        "Value 5: (datetime.date(2019, 7, 10), datetime.date(2019, 7, 12))" +
        "Value 6: ()" +
        "Value 7: 2019-07-06" +
        "Value 8: 2019-07-06" +
        "Value 9: 1970-01-01" +
        "Date Input Changed: False"
    );

    // remove input
    cy.getIndexed(".stDateInput", 4)
      .click()
      .type("{del}{selectall}{backspace}");

    // click outside of date input
    cy.contains("Range, two dates").click();

    // value should _not_ be reset to default (datetime.date(2019, 7, 6), and should have empty range value ()
    cy.get(".stMarkdown").should(
      "have.text",
      "Value 1: 1970-01-01" +
        "Value 2: 2019-07-06" +
        "Value 3: ()" +
        "Value 4: (datetime.date(2019, 7, 6),)" +
        "Value 5: ()" +
        "Value 6: ()" +
        "Value 7: 2019-07-06" +
        "Value 8: 2019-07-06" +
        "Value 9: 1970-01-01" +
        "Date Input Changed: False"
    );
  });
});
