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

describe("st.columns layout", () => {
  it("shows columns horizontally when viewport > 640", () => {
    cy.viewport(641, 800);
    cy.loadApp("http://localhost:3000/");

    cy.get("[data-testid='stHorizontalBlock']")
      .first()
      .matchImageSnapshot("columns-layout-horizontal");
  });

  it("stacks columns vertically when viewport <= 640", () => {
    cy.viewport(640, 800);
    cy.loadApp("http://localhost:3000/");

    cy.getIndexed("[data-testid='stHorizontalBlock']", 0).matchImageSnapshot(
      "columns-layout-vertical"
    );
  });

  it("still takes up space with no elements present", () => {
    cy.getIndexed("[data-testid='stHorizontalBlock']", 1).matchImageSnapshot(
      "columns-with-one-element"
    );
  });
});
