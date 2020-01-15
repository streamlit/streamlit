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

describe("main menu", () => {
  before(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get(".decoration").invoke("css", "display", "none");
  });

  it("displays menu dropdown", () => {
    cy.get("#ConnectionStatus").should("not.exist");

    // Main menu renders visually as we expect
    cy.get("#MainMenu").click();
    cy.get(".dropdown-menu").matchImageSnapshot("main_menu");

    // Not possible to test the urls in the menu as they are hidden behind
    // the click handler of the button
    // https://github.com/cypress-io/cypress-example-recipes/blob/master/examples/testing-dom__tab-handling-links/cypress/integration/tab_handling_anchor_links_spec.js
  });
});
