/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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

describe("st.tabs", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays correctly", () => {
    cy.get(".stTabs").should("have.length", 3);

    cy.get(".stTabs").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("tabs" + idx);
    });
  });

  it("displays correctly in sidebar", () => {
    cy.getIndexed("[data-testid='stSidebar'] .stTabs").should(
      "have.length",
      2
    );

    cy.getIndexed("[data-testid='stSidebar'] .stTabs", 0).within(() => {
      cy.get(".stMarkdown").should("have.text", "I am in the sidebar");
    });
  });

  it("changes rendered content on tab selection", () => {
    cy.getIndexed(".main .stTabs", 0).within(() => {
      let tab_2_button = cy.getIndexed("button", 1);
      tab_2_button.should("exist");
      tab_2_button.click();

      cy.get("[data-baseweb='tab-panel'] stNumberInput").should(
        "have.length",
        1
      );
    });
  });

  it("containes all tabs when overflowing", () => {
    cy.get(".stExpander .stTabs button").should("have.length", 25);
  });
});
