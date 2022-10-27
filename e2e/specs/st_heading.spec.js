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

describe("st.header", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays correct number of header elements", () => {
    cy.get(".element-container .stMarkdown h2").should("have.length", 2);
  });

  it("displays correct number of title elements", () => {
    cy.get(".element-container .stMarkdown h1").should("have.length", 3);
  });

  it("displays correct number of subheader elements", () => {
    cy.get(".element-container .stMarkdown h3").should("have.length", 2);
  });

  it("displays a header", () => {
    cy.get(".element-container .stMarkdown h2").then(els => {
      expect(els[0].textContent).to.eq("This header is awesome!");
      expect(els[1].textContent).to.eq("This header is awesome too!");
    });
  });

  it("displays headers with anchors", () => {
    cy.get(".element-container .stMarkdown h2").then(els => {
      cy.wrap(els[0]).should("have.attr", "id", "this-header-is-awesome");
      cy.wrap(els[1]).should("have.attr", "id", "awesome-header");
    });
  });

  it("displays markdown properly after a new line", () => {
    cy.get(".element-container .stMarkdown")
      .first()
      .find("a")
      .should("have.attr", "href");
  })

  it("should display links correctly", () => {
    cy
      .getIndexed(".element-container .stMarkdown h1", 3)
      .matchThemedSnapshots("heading_link");
  })
});
