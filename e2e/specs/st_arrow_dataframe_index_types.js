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

describe("st.dataframe supports a variety of index types", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
    cy.prepForElementSnapshots();
  });

  it("renders element correctly", () => {
    cy.get(".stDataFrame").should("have.length", 10);

    /** Since glide-data-grid uses HTML canvas for rendering the table we
    cannot run any tests based on the HTML DOM. Therefore, we only use snapshot
    matching to test that our table examples render correctly. In addition, glide-data-grid
    itself also has more advanced canvas based tests for some of the interactive features. */

    cy.get(".stDataFrame").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("dataframe-index-types-" + idx);
    });
  });
});
