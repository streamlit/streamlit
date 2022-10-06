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

describe("st.experimental_get_query_string", () => {
  beforeEach(() => {
    cy.loadApp(
      "http://localhost:3000/?" +
        "show_map=True&number_of_countries=2&selected=asia&selected=america"
    );

    cy.prepForElementSnapshots();
  });

  it("shows query string correctly", () => {
    cy.get(".element-container [data-testid='stMarkdownContainer']").should(
      "have.length",
      1
    );
    cy.contains(
      "Current query string is: {" +
        "'show_map': ['True'], " +
        "'number_of_countries': ['2'], " +
        "'selected': ['asia', 'america']" +
        "}"
    );
  });
});
