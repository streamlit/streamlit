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

describe("st.header & st.subheader dividers", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays correctly when divider=True", () => {
    cy.get(".element-container .stMarkdown h2").should("have.length", 3);
    cy.get(".element-container .stMarkdown h3").should("have.length", 3);
    cy.get(".stHeadingContainer").should("have.length", 6)

    const expectedColors = [ "blue", "green", "orange", "red", "violet", "blue"]
    expectedColors.forEach( (color, idx) => {
      cy.getIndexed(".stHeadingContainer", idx).matchThemedSnapshots(`divider-${color}${idx}`)
    })
  });
});
