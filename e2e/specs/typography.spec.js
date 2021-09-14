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

describe("app typography", () => {
  // Doesn't have to run before each, since these tests are stateless.
  before(() => {
    cy.visit("http://localhost:3000/");

    // Wait for 'data-stale' attr to go away, so the snapshot looks right.
    cy.get(".element-container")
      .should("have.attr", "data-stale", "false")
      .invoke("css", "opacity", "1");
  });

  it("matches the snapshot for main vs sidebar", () => {
    cy.get("body").matchThemedSnapshots("main-vs-sidebar");
  });

  it("matches the snapshot for single st.markdown", () => {
    getElementNextToText("Headers in single st.markdown").matchThemedSnapshots(
      "single-markdown"
    );
  });

  it("matches the snapshot for multiple st.markdown", () => {
    getElementNextToText(
      "Headers in multiple st.markdown"
    ).matchThemedSnapshots("multiple-markdown");
  });

  it("matches the snapshot for columns", () => {
    getElementNextToText("Headers in columns").matchThemedSnapshots(
      "columns-markdown"
    );
  });

  it("matches the snapshot for columns with elements above", () => {
    getElementNextToText(
      "Headers in columns with other elements above"
    ).matchThemedSnapshots("columns-padded-markdown");
  });

  it("matches the snapshot for column beside widget", () => {
    getElementNextToText(
      "Headers in column beside widget"
    ).matchThemedSnapshots("column-widget-markdown");
  });
});

function getElementNextToText(text) {
  return cy
    .get("[data-testid='stText']")
    .contains(text)
    .parent()
    .next();
}
