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

describe("st.exception", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();

    // Ensure both exceptions show up before running tests
    cy.get(".element-container .stException").should("have.length", 2);
  });

  it("displays an exception message", () => {
    cy.get(".element-container .stException")
      .eq(0)
      .should("contain", "This exception message is awesome!");
  });

  it("displays a long exception message properly", () => {
    cy.get(".element-container .stException")
      .eq(1)
      .matchThemedSnapshots("long_exception");
  });
});
