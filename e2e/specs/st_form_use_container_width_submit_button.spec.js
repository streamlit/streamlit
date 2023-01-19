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

const path = require("path");

describe("st.form with use_container_width=True button", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });


  it("renders use_container_width=True st.submit_form_button correctly", () => {
    cy.get("[data-testid='stFormSubmitButton'] button")
      .should("have.length.at.least", 1)
      .first().matchThemedSnapshots("use-container-width-submit-form-button");
  });
});
