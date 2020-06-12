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

describe("Dataframes", () => {
  const DF_SELECTOR = ".stDataFrame";
  const TABLE_SELECTOR = ".stTable > table.table";

  before(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get(".decoration").invoke("css", "display", "none");
  });

  it("show a tooltip for each cell", () => {
    // Each cell's title should be equal to its text content.
    // (We just check the first dataframe, rather than every single one.)
    cy.get(DF_SELECTOR)
      .first()
      .within(() => {
        cy.get(`div.data`).each(el => {
          expect(el.text()).to.eq(el.attr("title"));
        });
      });
  });

  it("have consistent st.dataframe visuals", () => {
    cy.get(DF_SELECTOR).each((el, idx) => {
      return cy.wrap(el).matchImageSnapshot("dataframe-visuals" + idx);
    });
  });

  it("have consistent st.table visuals", () => {
    cy.get(TABLE_SELECTOR).each((el, idx) => {
      return cy.wrap(el).matchImageSnapshot("table-visuals" + idx);
    });
  });
});
