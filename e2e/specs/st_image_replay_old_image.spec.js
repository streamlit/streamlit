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

describe("st.image replay", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

  });

  it("shows a cached image that was not rendered in previous script run", () => {
    // Displays the image initially
    cy.get(".element-container [data-testid='stImage'] img")
      .should("have.css", "height", "100px")
      .should("have.css", "width", "100px");

    // Uncheck checkbox to hide image
    cy.get(".stCheckbox")
      .first()
      .click({ multiple: true });
    cy.get(".element-container [data-testid='stImage'] img")
      .should("not.exist");

    // Cached image renders again
    cy.get(".stCheckbox")
      .first()
      .click({ multiple: true });
    cy.get(".element-container [data-testid='stImage'] img")
      .should("have.css", "height", "100px")
      .should("have.css", "width", "100px");
  })
})
