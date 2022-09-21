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

describe("Empty Arrow Tables", () => {
  const TABLE_SELECTOR = "[data-testid='stTable'] > table";

  before(() => {
    // http://gs.statcounter.com/screen-resolution-stats/desktop/worldwide
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();

    // Wait for the site to be fully loaded
    cy.get(".element-container").should($els => {
      expect($els).to.have.length.of.at.least(6);
    });
  });

  it("have consistent empty table visuals", () => {
    cy.get(TABLE_SELECTOR)
      .filter(idx => idx >= 0 && idx <= 3)
      .each((el, idx) => {
        return cy.wrap(el).matchThemedSnapshots(`arrow_empty_tables${idx}`);
      });
  });

  it("have consistent empty one-column table visuals", () => {
    cy.getIndexed(TABLE_SELECTOR, 4).each((el, idx) => {
      return cy
        .wrap(el)
        .matchThemedSnapshots(`arrow_empty_tables_one_col${idx}`);
    });
  });

  it("have consistent empty two-column table visuals", () => {
    cy.getIndexed(TABLE_SELECTOR, 5).each((el, idx) => {
      return cy
        .wrap(el)
        .matchThemedSnapshots(`arrow_empty_tables_two_col${idx}`);
    });
  });
});
