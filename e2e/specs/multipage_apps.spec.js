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

describe("st.map", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("loads the main streamlit_app script on initial page load", () => {
    cy.get(".element-container .stMarkdown h2").should("contain", "Main Page");
  });

  it("renders the SidebarNav correctly", () => {
    cy.prepForElementSnapshots();

    cy.get("[data-testid='stSidebarNav']").matchThemedSnapshots(
      "multipage-apps-sidebar-nav"
    );
  });

  it("can switch between pages by clicking on the SidebarNav links", () => {
    cy.getIndexed('[data-testid="stSidebarNav"] a', 1).click();

    cy.get(".element-container .stMarkdown h2").should("contain", "Page 2");
  });

  it("supports navigating to a page directly via URL", () => {
    cy.loadApp("http://localhost:3000/page2");
    cy.get(".element-container .stMarkdown h2").should("contain", "Page 2");
  });

  it("can switch between pages and edit widgets", () => {
    cy.getIndexed('[data-testid="stSidebarNav"] a', 2).click();

    cy.get(".element-container .stMarkdown h2").should("contain", "Page 3");

    cy.get(".element-container .stMarkdown p").should("contain", "x is 0");

    cy.get('.stSlider [role="slider"]')
      .click()
      .type("{rightarrow}", { force: true });

    cy.get(".element-container .stMarkdown p").should("contain", "x is 1");
  });
});
