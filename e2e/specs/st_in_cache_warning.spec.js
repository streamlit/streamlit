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

describe("st calls within cached functions", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays expected results", () => {
    // We should have two alerts
    cy.get(".element-container > .stException").should("have.length", 2);

    // One button
    cy.get(".element-container > .stButton").should("have.length", 1);

    // And three texts
    cy.get(".element-container > .stMarkdown").should("have.length", 3);
  });
});
