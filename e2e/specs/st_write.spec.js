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

describe("st.write", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  beforeEach(() => {
    cy.get(".element-container").should("have.length", 4);
  });

  it("displays markdown", () => {
    cy.getIndexed(".element-container .stMarkdown p", 0).contains(
      "This markdown is awesome! 😎"
    );
  });

  it("escapes HTML", () => {
    cy.getIndexed(".element-container .stMarkdown p", 1).contains(
      "This <b>HTML tag</b> is escaped!"
    );
  });

  it("st.write should display pyspark.sql.DataFrame as st.dataframe", () => {
    cy.get(".stDataFrame").should("have.length", 1);
  });

  it("allows HTML if defined explicitly", () => {
    cy.get(".element-container .stMarkdown p")
      .last()
      .contains("This HTML tag is not escaped!");
  });
});
