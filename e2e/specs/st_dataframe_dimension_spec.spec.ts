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

describe("Dataframes with different sizes", () => {
  // All widths are 2px smaller than actual width we set, due to 1px border.
  const expected = [
    { width: "696px", height: "300px" },
    { width: "248px", height: "150px" },
    { width: "248px", height: "300px" },
    { width: "696px", height: "150px" }
  ];
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("should show as expected", () => {
    cy.get(".element-container .stDataFrame")
      .should("have.length", 4)
      .each((el, idx) => {
        return cy
          .wrap(el)
          .should("have.css", "width", expected[idx].width)
          .should("have.css", "height", expected[idx].height);
      });
  });
});
