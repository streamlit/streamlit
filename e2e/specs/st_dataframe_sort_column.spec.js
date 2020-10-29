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

describe("st.dataframe - sort by column", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("resets sort column index if the sorted column was removed", () => {
    // Sort the dataframe by the last column.
    cy.get(".element-container .stDataFrame")
      .find(".dataframe.row-header")
      .last()
      .click();

    // Remove the last column.
    cy.get(".control.step-down").click();

    cy.get(".element-container .stDataFrame .sort-arrow-icon").should(
      "not.exist"
    );
  });
});
