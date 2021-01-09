/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

describe("st.markdown", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("displays correct number of elements", () => {
    cy.get(".element-container .stMarkdown").should("have.length", 11);
  });

  it("displays markdown", () => {
    cy.get(".element-container .stMarkdown").then(els => {
      expect(els[0].textContent).to.eq("This markdown is awesome! 😎");
      expect(els[1].textContent).to.eq("This <b>HTML tag</b> is escaped!");
      expect(els[2].textContent).to.eq("This HTML tag is not escaped!");
      expect(els[3].textContent).to.eq("[text]");
      expect(els[4].textContent).to.eq("link");
      expect(els[5].textContent).to.eq("[][]");
      expect(els[6].textContent).to.eq("Inline math with KATXE\\KaTeXKATE​X");
      expect(els[7].textContent).to.eq(
        "ax2+bx+c=0ax^2 + bx + c = 0ax2+bx+c=0"
      );
      expect(els[8].textContent).to.eq("Some header 1");
      expect(els[9].textContent).to.eq("Some header 2");
      expect(els[10].textContent).to.eq("Some header 3");

      cy.wrap(els[3])
        .find("a")
        .should("not.exist");
      cy.wrap(els[4])
        .find("a")
        .should("have.attr", "href");
    });
  });

  it("displays headers with anchors", () => {
    cy.get(".element-container .stMarkdown").then(els => {
      cy.wrap(els[8])
        .find("h1")
        .should("have.attr", "id", "some-header-1");
      cy.wrap(els[9])
        .find("h2")
        .should("have.attr", "id", "some-header-2");
      cy.wrap(els[10])
        .find("h3")
        .should("have.attr", "id", "some-header-3");
    });
  });
});
