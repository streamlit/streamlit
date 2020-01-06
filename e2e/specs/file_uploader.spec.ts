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

describe("st.file_uploader", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get(".decoration").invoke("css", "display", "none");
  });

  it("shows widget correctly", () => {
    cy.get(".stFileUploader").should("have.length", 1);
    cy.get(".stFileUploader label").should("have.text", "Drop a file:");

    cy.get(".stFileUploader").matchImageSnapshot("file_uploader");
  });

  it("shows error message for not allowed files", () => {
    cy.get(".stFileUploader").should("have.length", 1);
    cy.get(".stFileUploader label").should("have.text", "Drop a file:");

    const fileName = "example.json";

    cy.fixture(fileName).then(fileContent => {
      cy.get('[data-baseweb="file-uploader"] > div').upload(
        { fileContent, fileName, mimeType: "application/json" },
        { force: true, subjectType: "drag-n-drop" }
      );

      cy.get(".uploadError").should(
        "have.text",
        " application/json files are not allowedOK"
      );

      cy.get(".stFileUploader").matchImageSnapshot("file_uploader-error");
    });
  });

  it("shows uploaded file name", () => {
    cy.get(".stFileUploader").should("have.length", 1);
    cy.get(".stFileUploader label").should("have.text", "Drop a file:");

    const fileName = "example.txt";

    cy.fixture(fileName).then(fileContent => {
      cy.get('[data-baseweb="file-uploader"] > div').upload(
        { fileContent, fileName, mimeType: "text/plain" },
        { force: true, subjectType: "drag-n-drop" }
      );

      cy.get(".uploadDone").should("have.text", fileName);

      cy.get(".stFileUploader").matchImageSnapshot("file_uploader-uploaded");
    });
  });
});
