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

describe("st.subheader", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays correct number of elements", () => {
    cy.get(".element-container .stMarkdown h3").should("have.length", 2);
  });

  it("displays a subheader", () => {
    cy.get(".element-container .stMarkdown h3").then(els => {
      expect(els[0].textContent).to.eq("This subheader is awesome!");
      expect(els[1].textContent).to.eq("This subheader is awesome too!");
    });
  });

  it("displays subheaders with anchors", () => {
    cy.get(".element-container .stMarkdown h3").then(els => {
      cy.wrap(els[0]).should("have.attr", "id", "this-subheader-is-awesome");
      cy.wrap(els[1]).should("have.attr", "id", "awesome-subheader");
    });
  });
});
