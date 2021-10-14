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
const path = require("path");

describe("st.download_button", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  it("shows widget correctly", () => {
    cy.get(".stDownloadButton").should("have.length", 2);
    cy.get(".stDownloadButton")
      .first()
      .matchThemedSnapshots("download-button-widget");
  });

  it("downloads txt file when the button is clicked", () => {
    cy.get(".stDownloadButton button")
      .first()
      .click();
    const downloadsFolder = Cypress.config("downloadsFolder");
    cy.readFile(path.join(downloadsFolder, "hello.txt")).should(
      "eq",
      "Hello world!"
    );
  });

  it("downloads RAR archive file when the button is clicked", () => {
    cy.get(".stDownloadButton button")
      .last()
      .click();
    const downloadsFolder = Cypress.config("downloadsFolder");
    cy.readFile(path.join(downloadsFolder, "archive.rar")).should("exist");
  });
});
