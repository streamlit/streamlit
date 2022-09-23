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

describe("main menu", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays light main menu and about section properly", () => {
    cy.changeTheme("Light");

    // Main menu renders visually as we expect
    cy.get("#MainMenu > button").click();

    // Cypress cuts the popover off due to the transform property, so we move
    // the main menu to a location to show it clearly for snapshots.
    cy.get('[data-testid="main-menu-popover"]').invoke(
      "attr",
      "style",
      "transform: translate3d(20px, 20px, 0px)"
    );

    cy.getIndexed('[data-testid="main-menu-list"]', 0).matchImageSnapshot(
      "main_menu"
    );

    cy.getIndexed('[data-testid="main-menu-list"]', 1).matchImageSnapshot(
      "dev_main_menu"
    );

    // Not possible to test the urls in the menu as they are hidden behind
    // the click handler of the button
    // https://github.com/cypress-io/cypress-example-recipes/blob/master/examples/testing-dom__tab-handling-links/cypress/integration/tab_handling_anchor_links_spec.js

    // need to add testing for about section
  });

  it("displays dark main menu and about section properly", () => {
    cy.changeTheme("Dark");

    cy.get("#MainMenu > button").click();

    // Cypress cuts the popover off due to the transform property, so we move
    // the main menu to a location to show it clearly for snapshots.
    cy.get('[data-testid="main-menu-popover"]').invoke(
      "attr",
      "style",
      "transform: translate3d(20px, 20px, 0px)"
    );

    cy.getIndexed('[data-testid="main-menu-list"]', 0).matchImageSnapshot(
      "main_menu-dark"
    );

    cy.getIndexed('[data-testid="main-menu-list"]', 1).matchImageSnapshot(
      "dev_main_menu-dark"
    );

    // Need to add testing for about section
  });
});
