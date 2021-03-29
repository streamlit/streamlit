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

function getIframeBody(index) {
  return cy
    .get(".element-container > iframe")
    .eq(index)
    .should(iframe => {
      // Wait for a known element of the iframe to exist. In this case,
      // we wait for its button to appear. This will happen after the
      // handshaking with Streamlit is done.
      expect(iframe.contents().find("button")).to.exist;
    })
    .then(iframe => {
      // Return a snapshot of the iframe's body, now that we know it's
      // loaded.
      return cy.wrap(iframe.contents().find("body"));
    });
}

// These tests are run against both of our templates. One uses React, and
// the other is pure Typescript, but both should produce identical results.
describe("Component template", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  it("is rendered correctly", () => {
    cy.get(".element-container > iframe").should("have.length", 2);

    getIframeBody(0)
      .find("button")
      .should("have.text", "Click Me!");
    getIframeBody(1)
      .find("button")
      .should("have.text", "Click Me!");

    cy.get(".element-container > iframe").each((el, idx) => {
      return cy
        .wrap(el)
        .matchImageSnapshot(
          "iframe-" + Cypress.env("COMPONENT_TEMPLATE_TYPE") + idx
        );
    });

    cy.get(".element-container > .stMarkdown p").each(el => {
      expect(el.text()).to.eq("You've clicked 0 times!");
    });
  });

  it("sends data back to Streamlit", () => {
    getIframeBody(0)
      .find("button")
      .click();

    cy.get(".element-container > .stMarkdown p")
      .eq(0)
      .should("have.text", "You've clicked 1 times!");
  });
});
