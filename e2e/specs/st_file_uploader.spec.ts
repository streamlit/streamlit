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
    Cypress.Cookies.defaults({
      whitelist: ["_xsrf"]
    });

    cy.visit("http://localhost:3000/");

    cy.getCookie("_xsrf").should("exist");

    // Make the ribbon decoration line disappear
    cy.get(".decoration").invoke("css", "display", "none");
  });

  it("shows widget correctly", () => {
    cy.get(".stFileUploader")
      .first()
      .should("exist");
    cy.get(".stFileUploader label")
      .first()
      .should("have.text", "Drop a file:");

    cy.get(".stFileUploader")
      .first()
      .matchImageSnapshot("file_uploader");
  });

  it("shows error message for not allowed files", () => {
    const fileName = "example.json";

    cy.fixture(fileName).then(fileContent => {
      cy.get('[data-baseweb="file-uploader"] > div')
        .first()
        .upload(
          { fileContent, fileName, mimeType: "application/json" },
          {
            force: true,
            subjectType: "drag-n-drop",

            // We intentionally omit the "dragleave" trigger event here;
            // the page may start re-rendering after the "drop" event completes,
            // which causes a cypress error due to the element being detached
            // from the DOM when "dragleave" is emitted.
            events: ["dragenter", "drop"]
          }
        );

      cy.get(".uploadError")
        .first()
        .should("have.text", " application/json files are not allowedOK");

      cy.get(".stFileUploader")
        .first()
        .matchImageSnapshot("file_uploader-error");
    });
  });

  it("uploads single files", () => {
    const fileName = "file1.txt";

    cy.fixture(fileName).then(fileContent => {
      cy.get('[data-baseweb="file-uploader"] > div')
        .first()
        .upload(
          { fileContent, fileName, mimeType: "text/plain" },
          {
            force: true,
            subjectType: "drag-n-drop",
            events: ["dragenter", "drop"]
          }
        );

      cy.get(".uploadDone")
        .first()
        .should("have.text", fileName);
      cy.get(".fixed-width.stText")
        .first()
        .should("have.text", fileContent);

      cy.get(".stFileUploader")
        .first()
        .matchImageSnapshot("file_uploader-uploaded");
    });
  });

  // it("uploads multiple files", () => {
  //   const fileName1 = "file1.txt";
  //   const fileName2 = "file2.txt";

  //   // Yes, this actually is the recommended way to load multiple fixtures
  //   // in Cypress (!!) using Cypress.Promise.all is buggy. See:
  //   // https://github.com/cypress-io/cypress-example-recipes/blob/master/examples/fundamentals__fixtures/cypress/integration/multiple-fixtures-spec.js

  //   cy.fixture(fileName1).then(file1 => {
  //     cy.fixture(fileName2).then(file2 => {
  //       const files = [
  //         { fileContent: file1, fileName: fileName1, mimeType: "text/plain" },
  //         { fileContent: file2, fileName: fileName2, mimeType: "text/plain" }
  //       ];

  //       cy.get('[data-baseweb="file-uploader"] > div')
  //         .eq(1)
  //         .upload(files, {
  //           force: true,
  //           subjectType: "drag-n-drop",
  //           events: ["dragenter", "drop"]
  //         });

  //       // The widget should show the names of the uploaded files.
  //       const filenames = [fileName1, fileName2].join(", ");
  //       cy.get(".uploadDone")
  //         .eq(0) // eq(0), instead of eq(1), because the first widget won't have an uploadDone
  //         .should("have.text", filenames);

  //       // The script should have printed the contents of the two files
  //       // into an st.text. (This tests that the upload actually went
  //       // through.)
  //       const content = [file1, file2].sort().join("\n");
  //       cy.get(".fixed-width.stText")
  //         .eq(1)
  //         .should("have.text", content);
  //     });
  //   });
  // });
});
