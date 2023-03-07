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

describe("app typography", () => {
  // Doesn't have to run before each, since these tests are stateless.
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();

    // Wait for 'data-stale' attr to go away, so the snapshot looks right.
    cy.get(".element-container")
      .should("have.attr", "data-stale", "false")
      .invoke("css", "opacity", "1");
  });

  it("matches the snapshot for the top part of the main and sidebar blocks", () => {
    // This test just checks whether the top alignment of main/sidebar elements is correct.

    // Wait for end of page to load, to de-flake the test.
    cy.get(".main").contains("End of page");

    cy.get(".appview-container")
      .first()
      .matchImageSnapshot("main-sidebar-top");
  });

  it("matches the snapshot for single st.markdown", () => {
    getElementNextToText("Headers in single st.markdown").matchImageSnapshot(
      "single-markdown"
    );
  });

  it("matches the snapshot for multiple st.markdown", () => {
    // [Thiago] Unfortunately, I couldn't figure out a way to do this test without repeating
    // getElementNextToText() and .next() forever :(

    const topText = "Headers in multiple st.markdown";

    getElementNextToText(topText).then(el =>
      cy.wrap(el).matchImageSnapshot("multiple-markdown-h1")
    );

    getElementNextToText(topText)
      .next()
      .then(el => cy.wrap(el).matchImageSnapshot("multiple-markdown-h2"));

    getElementNextToText(topText)
      .next()
      .next()
      .then(el => cy.wrap(el).matchImageSnapshot("multiple-markdown-h3"));

    getElementNextToText(topText)
      .next()
      .next()
      .next()
      .then(el => cy.wrap(el).matchImageSnapshot("multiple-markdown-h4"));

    getElementNextToText(topText)
      .next()
      .next()
      .next()
      .next()
      .then(el => cy.wrap(el).matchImageSnapshot("multiple-markdown-h5"));

    getElementNextToText(topText)
      .next()
      .next()
      .next()
      .next()
      .next()
      .then(el => cy.wrap(el).matchImageSnapshot("multiple-markdown-h6"));

    getElementNextToText(topText)
      .next()
      .next()
      .next()
      .next()
      .next()
      .next()
      .then(el => cy.wrap(el).matchImageSnapshot("multiple-markdown-p"));
  });

  it("matches the snapshot for columns", () => {
    getElementNextToText("Headers in columns").matchImageSnapshot(
      "columns-markdown"
    );
  });

  it("matches the snapshot for columns with elements above", () => {
    getElementNextToText(
      "Headers in columns with other elements above"
    ).matchImageSnapshot("columns-padded-markdown");
  });

  it("matches the snapshot for column beside widget", () => {
    getElementNextToText("Headers in column beside widget").matchImageSnapshot(
      "column-widget-markdown"
    );
  });
});

function getElementNextToText(text) {
  return cy
    .get("[data-testid='stText']")
    .contains(text)
      .parent()
    .parent()
    .next();
}
