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

describe("Legacy Dataframes", () => {
  const DF_SELECTOR = ".stDataFrame";

  before(() => {
    // http://gs.statcounter.com/screen-resolution-stats/desktop/worldwide
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();

    // Wait for the site to be fully loaded
    cy.get(".element-container").should($els => {
      expect($els).to.have.length.of.at.least(10);
    });
  });

  it("have consistent empty visuals", () => {
    cy.get(DF_SELECTOR).each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots(`legacy_empty_dataframes${idx}`);
    });
  });
});
