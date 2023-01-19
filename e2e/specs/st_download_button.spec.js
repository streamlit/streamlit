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

const path = require("path");
const NO_OF_BUTTONS = 4

describe("st.download_button", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("shows widget correctly", () => {
    cy.get(".stDownloadButton").should("have.length", NO_OF_BUTTONS);
    cy.get(".stDownloadButton")
      .first()
      .matchThemedSnapshots("download-button-widget");
  });

  it("shows disabled widget correctly", () => {
    cy.get(".stDownloadButton").should("have.length", NO_OF_BUTTONS);
    cy.getIndexed(".stDownloadButton", 1).matchThemedSnapshots(
      "disabled-download-button"
    );
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
    cy.getIndexed(".stDownloadButton button", 2)
      .should("have.length.at.least", 1)
      .click();
    const downloadsFolder = Cypress.config("downloadsFolder");
    cy.readFile(path.join(downloadsFolder, "archive.rar")).should("exist");
  });

  it("renders useContainerWidth st.download_button correctly", () => {
    cy.get(".stDownloadButton button")
      .should("have.length.at.least", 1)
      .last()
      .click().matchThemedSnapshots("use-container-width-button");
  });
});
