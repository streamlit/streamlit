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

describe("st.add_rows", () => {
  // Doesn't have to run before each, since these tests are stateless.
  before(() => {
    cy.visit("http://localhost:3000/");

    // Rerun the script because we want to test that JS-side coalescing works.
    cy.get(".stApp .decoration").trigger("keypress", {
      keyCode: 82, // "r"
      which: 82 // "r"
    });

    // Wait for 'stale-element' class to go away, so the snapshot looks right.
    cy.get(".element-container").should("not.have.class", "stale-element");

    // Make the ribbon decoration line disappear
    cy.get(".decoration").invoke("css", "display", "none");
  });

  beforeEach(() => {
    // Check that the app is fully loaded
    return cy.get(".element-container").should("have.length", 26);
  });

  it("correctly adds rows to charts", () => {
    cy.get(".element-container .stVegaLiteChart").each((el, i) => {
      return cy.get(el).matchImageSnapshot(`stVegaLiteChart-${i}`);
    });
  });
});
