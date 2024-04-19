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

describe("st.markdown", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays correct number of elements", () => {
    cy.get(".element-container .stMarkdown").should("have.length", 25);
  });

  it("displays markdown", () => {
    cy.get(".element-container .stMarkdown").then((els) => {
      expect(els[0].textContent).to.eq("This markdown is awesome! 😎");
      expect(els[1].textContent).to.eq("This <b>HTML tag</b> is escaped!");
      expect(els[2].textContent).to.eq("This HTML tag is not escaped!");
      expect(els[3].textContent).to.eq("[text]");
      expect(els[4].textContent).to.eq("link");
      expect(els[5].textContent).to.eq("[][]");
      expect(els[6].textContent).to.eq("Inline math with KaTeX\\KaTeXKATE​X");
      expect(els[7].textContent).to.eq(
        "ax2+bx+c=0ax^2 + bx + c = 0ax2+bx+c=0"
      );
      expect(els[8].textContent).to.eq("Some header 1");
      expect(els[9].textContent).to.eq("Some header 2");
      expect(els[10].textContent).to.eq("Some header 3");
      expect(els[11].textContent).to.eq("Col1Col2SomeData");
      expect(els[21].textContent).to.eq("Bold text within blue background");
      expect(els[21].getElementsByTagName("span")[0].style.backgroundColor).to.eq("rgba(28, 131, 225, 0.1)");
      expect(els[22].textContent).to.eq("Italic text within red background");
      expect(els[22].getElementsByTagName("span")[0].style.backgroundColor).to.eq("rgba(255, 43, 43, 0.1))");
      expect(els[23].textContent).to.eq("Link within rainbow background");
      expect(els[23].getElementsByTagName("span")[0].style.background).to.eq("linear-gradient(to right, rgba(255, 43, 43, 0.1), rgba(255, 227, 18, 0.1), rgba(255, 227, 18, 0.1), rgba(33, 195, 84, 0.1), rgba(28, 131, 225, 0.1), rgba(128, 61, 245, 0.1), rgba(88, 63, 132, 0.1))");
      expect(els[24].textContent).to.eq("LaTeX math within green background: ax2+bx+c=0ax^2 + bx + c = 0ax2+bx+c=0");
      expect(els[24].getElementsByTagName("span")[0].style.backgroundColor).to.eq("rgba(33, 195, 84, 0.1)");

      cy.wrap(els[3]).find("a").should("not.exist");
      cy.wrap(els[4]).find("a").should("have.attr", "href");
    });
  });

  it("displays headers with anchors", () => {
    cy.get(".element-container .stMarkdown").then((els) => {
      cy.wrap(els[8]).find("h1").should("have.attr", "id", "some-header-1");
      cy.wrap(els[9]).find("h2").should("have.attr", "id", "some-header-2");
      cy.wrap(els[10]).find("h3").should("have.attr", "id", "some-header-3");
    });
  });

  it("has consistent st.markdown visuals", () => {
    cy.get(".element-container .stMarkdown").each((el, i) => {
      // The 6th st.markdown element is an empty one, so cypress gets confused
      // when attempting to take a snapshot of it. We also have to handle the
      // markdown table differently; see the comment below.
      if (i !== 5 && i !== 8) {
        return cy.wrap(el).matchThemedSnapshots(`markdown-visuals-${i}`);
      }
    });
  });

  // Tables in html are weird and hard to take snapshots of since they may
  // overflow their parent elements while still rendering correctly, so we deal
  // with taking these snapshots separately from the ones above.
  it("has consistent st.markdown table visuals", () => {
    const els = cy.get(".element-container .stMarkdown table");
    els.should("have.length", 1);
    els.first().matchThemedSnapshots("markdown-table-visuals");
  });

  it("displays long headers above other elements correctly", () => {
    cy.get("[data-testid='stVerticalBlock'] [data-testid='stVerticalBlock']")
      .eq(0)
      .matchThemedSnapshots("long-markdown-header-above-table");
  });

  it("displays headings and markdown when called separately or together", () => {
    cy.get("[data-testid='stVerticalBlock'] [data-testid='stVerticalBlock']")
      .eq(1)
      .matchThemedSnapshots("heading-and-markdown-combinations");
  });
});
