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

describe("main menu", () => {
  before(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  it("displays about dialog properly", () => {
    cy.get("[data-testid='stConnectionStatus']").should("not.exist");

    // Main menu renders visually as we expect
    cy.get("#MainMenu > button").click();

    // Cypress cuts the popover off due to the transform property, so we move
    // the main menu to a location to show it clearly for snapshots.
    cy.get('[data-testid="main-menu-popover"]').invoke(
      "attr",
      "style",
      "transform: translate3d(20px, 20px, 0px)"
    );
    cy.get('[data-testid="main-menu-list"]')
      .eq(0)
      .matchThemedSnapshots("main_menu");
    cy.get('[data-testid="main-menu-list"]')
      .eq(1)
      .matchThemedSnapshots("dev_main_menu");

    cy.get('[data-testid="main-menu-list"]')
      .eq(0)
      .get("li")
      // There are two lis per item in main menu to have configurable styles.
      .eq(10)
      .click();
    cy.get('[role="dialog"]')
      .invoke("show")
      .matchThemedSnapshots("about");
    cy.get('[role="dialog"] > button').click();
  });
});
