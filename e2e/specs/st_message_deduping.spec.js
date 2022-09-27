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

describe("message_deduping", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays two dataframes", () => {
    // Hack to make Cypress wait a little bit before searching for stDataFrame.
    // (This waits for 2 suspense placeholders and 1 st.write() to show)
    cy.get(".element-container .stMarkdown").should("have.text", "hello!");

    cy.get(".element-container .stDataFrame").should("have.length", 2);
  });
});
