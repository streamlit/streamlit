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

describe("st._arrow_dataframe - sort by column", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    cy.get(".element-container .stDataFrame")
      .find("[data-testid='StyledDataFrameColHeaderCell']")
      .last()
      .as("lastColumn");
  });

  it("toggles sort direction to asc when clicked once", () => {
    cy.get("@lastColumn").click();

    cy.get("@lastColumn").get("[data-test-sort-direction='ascending']");
  });

  it("toggles sort direction to desc when clicked twice", () => {
    cy.get("@lastColumn").click();
    cy.get("@lastColumn").click();

    cy.get("@lastColumn").get("[data-test-sort-direction='descending']");
  });

  // Issue: https://github.com/streamlit/streamlit/issues/2321
  it("toggles sort direction to asc when clicked 3 times", () => {
    cy.get("@lastColumn").click();
    cy.get("@lastColumn").click();
    cy.get("@lastColumn").click();

    cy.get("@lastColumn").get("[data-test-sort-direction='ascending']");
  });

  // Issue: https://github.com/streamlit/streamlit/issues/1105
  it("resets sort column index if the sorted column was removed", () => {
    cy.get("@lastColumn").click();
    // Remove the last column.
    cy.get(".step-down").click();

    cy.get(".stDataFrame [data-testid='sortIcon']").should("not.exist");
  });
});
