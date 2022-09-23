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

describe("DataFrame with different sizes", () => {
  const expected = [
    { width: "704px", height: "400px" },
    { width: "250px", height: "150px" },
    { width: "250px", height: "400px" },
    { width: "704px", height: "150px" },
    { width: "704px", height: "5000px" },
    { width: "704px", height: "400px" },
    { width: "500px", height: "400px" },
    { width: "704px", height: "400px" },
    { width: "704px", height: "400px" },
    { width: "200px", height: "400px" },
    { width: "704px", height: "400px" },
  ];

  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("should show as expected", () => {
    cy.get(".stDataFrame")
      .should("have.length", 11)
      .each(($element, index) => {
        return cy
          .wrap($element)
          .should("have.css", "width", expected[index].width)
          .should("have.css", "height", expected[index].height);
      });
  });
});
