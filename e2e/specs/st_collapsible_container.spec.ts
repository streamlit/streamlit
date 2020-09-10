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

/// <reference types="cypress" />

const toggleIdentifier = "small[data-toggle]";

describe("st.collapsible_container", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("displays collapsible + regular containers properly", () => {
    cy.get(".stBlock")
      .first()
      .within(() => {
        cy.get(toggleIdentifier).should("not.exist");
      });
    cy.get(".stBlock")
      .eq(1)
      .within(() => {
        cy.get(toggleIdentifier).should("exist");
      });
    cy.get(".stBlock")
      .eq(2)
      .within(() => {
        cy.get(toggleIdentifier).should("exist");
      });
  });

  it("collapses + expands", () => {
    // Starts expanded
    cy.get(".stBlock")
      .eq(1)
      .within(() => {
        let toggle = cy.get(toggleIdentifier);
        toggle.should("exist");
        toggle.should("have.text", "Hide");
        toggle.click();

        toggle = cy.get(toggleIdentifier);
        toggle.should("have.text", "Show");
      });
    // Starts collapsed
    cy.get(".stBlock")
      .eq(2)
      .within(() => {
        let toggle = cy.get(toggleIdentifier);
        toggle.should("exist");
        toggle.should("have.text", "Show");
        toggle.click();

        toggle = cy.get(toggleIdentifier);
        toggle.should("have.text", "Hide");
      });
  });
});
