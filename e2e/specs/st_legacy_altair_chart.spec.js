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

describe("st._legacy_altair_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays an altair chart", () => {
    cy.get(".element-container [data-testid='stVegaLiteChart']")
      .find("canvas")
      .should("have.class", "marks");
  });
});
