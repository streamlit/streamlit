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

describe("Arrow Tables snapshots", () => {
  before(() => {
    // Increasing timeout since we're waiting for
    // tables to be rendered.
    Cypress.config("defaultCommandTimeout", 30000);

    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();

    // HACK: Add `overflow: auto` to all tables to prevent Cypress
    // from throwing [RangeError: The value of "offset" is out of range.]
    cy.get("[data-testid='stTable']").each($element => {
      cy.wrap($element).invoke("css", "overflow", "auto");
    });
  });

  it("have consistent st._arrow_table visuals", () => {
    cy.get("[data-testid='stTable']").each(($element, index) => {
      return cy
        .wrap($element)
        .matchThemedSnapshots("arrow-table-visuals" + index);
    });
  });
});
