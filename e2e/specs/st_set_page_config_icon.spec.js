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

describe("st.set_page_config", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("sets the page favicon with ico file", () => {
    cy.get("link[rel='shortcut icon']")
      .should("have.attr", "href")
      .should(
        "contain",
        "d1e92a291d26c1e0cb9b316a93c929b3be15899677ef3bc6e3bf3573.png"
      );
  });
});
