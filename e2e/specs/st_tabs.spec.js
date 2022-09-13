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

describe("st.tabs", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays correctly", () => {
    cy.get(".stTabs").should("have.length", 3);

    cy.get(".stTabs").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("tabs" + idx);
    });
  });

  it("displays correctly in sidebar", () => {
    cy.get("[data-testid='stSidebar'] .stTabs [data-baseweb='tab']").should(
      "have.length",
      2
    );

    cy.get("[data-testid='stSidebar'] .stTabs").first()
      .within(() => {
        cy.get(".stMarkdown").first().should("have.text", "I am in the sidebar");
      });

    // text from every tab should be here because renderAll property is set to true
    cy.get("[data-testid='stSidebar'] .stTabs")
      .first()
      .within(() => {
        cy.get(".stMarkdown").should("have.text", "I am in the sidebarI'm also in the sidebar");
      });
  });

  it("changes rendered content on tab selection", () => {
    cy.getIndexed(".main .stTabs", 0).within(() => {
      let tab_2_button = cy.getIndexed("[data-baseweb='tab']", 1);
      tab_2_button.should("exist");
      tab_2_button.click();

      cy.get("[data-baseweb='tab-panel'] .stNumberInput").should(
        "have.length",
        1
      );
    });
  });

  it("contains all tabs when overflowing", () => {
    cy.get("[data-testid='stExpander'] .stTabs [data-baseweb='tab']").should(
      "have.length",
      25
    );
  });
});
