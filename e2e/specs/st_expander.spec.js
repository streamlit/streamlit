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

const expanderHeaderIdentifier = ".streamlit-expanderHeader";

describe("st.expander", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays expander + regular containers properly", () => {
    cy.getIndexed(".main [data-testid='stExpander']", 0).within(() => {
      cy.get(expanderHeaderIdentifier).should("exist");
    });
    cy.getIndexed(".main [data-testid='stExpander']", 1).within(() => {
      cy.get(expanderHeaderIdentifier).should("exist");
    });

    cy.getIndexed(
      "[data-testid='stSidebar'] [data-testid='stExpander']",
      0
    ).within(() => {
      cy.get(expanderHeaderIdentifier).should("exist");
    });
  });

  it("displays correctly", () => {
    // Focus the button, then ensure it's not cut off
    // See https://github.com/streamlit/streamlit/issues/2437
    cy.get(".stButton button").focus();
    cy.get(".main").matchThemedSnapshots("expanders-in-main");
    cy.get("[data-testid='stSidebar']").matchThemedSnapshots(
      "expanders-in-sidebar"
    );
  });

  it("collapses + expands", () => {
    // Starts expanded
    cy.getIndexed(".main [data-testid='stExpander']", 0).within(() => {
      const expanderHeader = cy.get(expanderHeaderIdentifier);
      expanderHeader.should("exist");

      let toggle = cy.get("svg");
      toggle.should("exist");
      expanderHeader.click();

      toggle = cy.get("svg");
      toggle.should("exist");
    });

    // Starts collapsed
    cy.getIndexed(".main [data-testid='stExpander']", 1).within(() => {
      let expanderHeader = cy.get(expanderHeaderIdentifier);
      expanderHeader.should("exist");

      let toggle = cy.get("svg");
      toggle.should("exist");
      expanderHeader.click();

      toggle = cy.get("svg");
      toggle.should("exist");
    });
  });
});
