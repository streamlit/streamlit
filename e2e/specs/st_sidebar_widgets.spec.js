/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

const NUM_WIDGETS = 35;

describe("sidebar widgets", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("matches snapshots", () => {
    cy.wrap(Cypress._.range(0, NUM_WIDGETS)).each(idx => {
      cy.get(".stTextInput input")
        .first()
        .clear()
        .type("clear{enter}");
      cy.get("[data-testid='stSidebar'] [data-testid='stBlock']").should(
        "not.exist"
      );
      cy.get(".stTextInput input")
        .first()
        .clear()
        .type(`${idx}{enter}`);
      cy.get("[data-testid='stSidebar'] [data-testid='stBlock']").should(
        "exist"
      );
      cy.get("[data-testid='stSidebar']").matchImageSnapshot(
        "sidebar-widgets" + idx
      );
    });
  });
});
