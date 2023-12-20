/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

const path = require("path");

describe("st.form_submit_button", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("renders correctly with use_container_width=True", () => {
    cy.get("[data-testid='stFormSubmitButton'] button")
      .should("have.length.at.least", 1)
      .first().matchThemedSnapshots("use-container-width-submit-form-button");
  });

  it("renders correctly with use_container_width=True and help text", () => {
    cy.getIndexed("[data-testid='stFormSubmitButton'] button", 1)
      .trigger('mouseover').matchThemedSnapshots("form-submit-button-container-and-help", { padding: [60, 0, 0, 0] });
  });
});
