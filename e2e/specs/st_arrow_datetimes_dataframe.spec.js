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

describe("st._arrow_dataframe", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");
    cy.get(".element-container .stDataFrame")
      .find(".ReactVirtualized__Grid__innerScrollContainer")
      .find("[data-testid='StyledDataFrameDataCell']")
      .as("cells");
  });

  it("displays datetimes correctly", () => {
    const datetimeString = "2020-04-14T00:00:00";

    // Assert that notz and yaytz render as desired.
    //
    // We can't just assert "have.text" against a hardcoded string, because the
    // timezone we want displayed depends on whatever timezone the test is
    // being run in.  So we use moment to dynamically generate the correct
    // string.
    //
    // This feels a little like "tautologically copying the code we're trying
    // to test into the test itself," but we're still contingently testing the
    // actual important thing, the notz/yaytz logic.

    // notz column should show datetime in current timezone
    cy.get("@cells")
      .eq(1)
      .should(
        "have.text",
        Cypress.moment(datetimeString).format("YYYY-MM-DDTHH:mm:ss")
      );

    // yaytz column should show datetime in provided timezone
    cy.get("@cells")
      .eq(2)
      .should(
        "have.text",
        Cypress.moment.parseZone(`${datetimeString}+03:00`).format()
      );
  });
});
