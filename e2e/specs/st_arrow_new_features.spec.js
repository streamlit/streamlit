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

describe("st_arrow_new_feautres", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    // Make the ribbon decoration line disappear.
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");

    // Wait for all the tables to be loaded.
    cy.get("[data-testid='stTable']").should("have.length", 7);
  });

  it("has consistent visuals", () => {
    cy.get("[data-testid='stTable']").each(($element, index) => {
      return cy
        .wrap($element)
        .matchThemedSnapshots("arrow-new-features-visuals" + index);
    });
  });
});
