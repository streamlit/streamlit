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

describe("st.sidebar", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays sidebar correctly", () => {
    cy.get("[data-testid='stSidebar']").matchThemedSnapshots("sidebar");
  });

  it("handles z-index of date input popover", () => {
    cy.get("[data-testid='stSidebar'] .stDateInput").should("have.length", 2);

    cy.get("[data-testid='stSidebar'] .stDateInput")
      .first()
      .click();

    cy.get("[data-testid='stSidebar']").matchImageSnapshot(
      "date-popover-sidebar",
      {
        force: true
      }
    );
  });

  it("handles overwriting elements", () => {
    cy.get("[data-testid='stSidebar'] [data-testid='stText']").contains(
      "overwritten"
    );
  });

  it("collapses the sidebar on mobile resize", () => {
    cy.viewport(800, 400);
    cy.get("[data-testid='stSidebar']").should(
      "have.attr",
      "aria-expanded",
      "true"
    );

    cy.viewport(400, 800);
    cy.get("[data-testid='stSidebar']").should(
      "have.attr",
      "aria-expanded",
      "false"
    );
  });

  it("does not collapse on text input on mobile", () => {
    cy.viewport(400, 800);
    // Expand the sidebar on mobile, with a manual click
    cy.get("[data-testid='collapsedControl'] button").click();

    cy.get("[data-testid='stSidebar'] .stTextInput input").click();

    cy.get("[data-testid='stSidebar']").should(
      "have.attr",
      "aria-expanded",
      "true"
    );
  });
});
