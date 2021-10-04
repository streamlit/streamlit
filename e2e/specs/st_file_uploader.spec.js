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

describe("st.file_uploader", () => {
  beforeEach(() => {
    Cypress.Cookies.defaults({
      preserve: ["_xsrf"]
    });
    cy.server();
    cy.route("POST", "**/upload_file").as("uploadFile");

    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  it("shows widget correctly", () => {
    cy.get("[data-testid='stFileUploader']")
      .eq(0)
      .should("exist");
    cy.get("[data-testid='stFileUploader'] label")
      .eq(0)
      .should("have.text", "Drop a file:");

    cy.get("[data-testid='stFileUploader']")
      .eq(0)
      .matchThemedSnapshots("single_file_uploader");

    cy.get("[data-testid='stFileUploader']")
      .eq(1)
      .matchThemedSnapshots("multi_file_uploader");
  });

  it("shows error message for disallowed files", () => {
    const fileName = "example.json";
    const uploaderIndex = 0;

    cy.fixture(fileName).then(fileContent => {
      cy.get("[data-testid='stFileUploadDropzone']")
        .eq(uploaderIndex)
        .attachFile(
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

      cy.get("[data-testid='stUploadedFileErrorMessage']")
        .eq(uploaderIndex)
        .should("have.text", "application/json files are not allowed.");

      cy.get("[data-testid='stFileUploader']")
        .eq(uploaderIndex)
        .matchThemedSnapshots("file_uploader-error");
    });
  });

  it("uploads and deletes single file only", () => {
    const fileName1 = "file1.txt";
    const fileName2 = "file2.txt";
    const uploaderIndex = 0;

    // Yes, this actually is the recommended way to load multiple fixtures
    // in Cypress (!!) using Cypress.Promise.all is buggy. See:
    // https://github.com/cypress-io/cypress-example-recipes/blob/master/examples/fundamentals__fixtures/cypress/integration/multiple-fixtures-spec.js
    // Why can’t I use async / await?
    // If you’re a modern JS programmer you might hear “asynchronous” and think: why can’t I just use async/await instead of learning some proprietary API?
    // https://docs.cypress.io/guides/core-concepts/introduction-to-cypress.html#Commands-Are-Asynchronous
    cy.fixture(fileName1).then(file1 => {
      cy.fixture(fileName2).then(file2 => {
        const files = [
          { fileContent: file1, fileName: fileName1, mimeType: "text/plain" },
          { fileContent: file2, fileName: fileName2, mimeType: "text/plain" }
        ];

        cy.get("[data-testid='stFileUploadDropzone']")
          .eq(uploaderIndex)
          .attachFile(files[0], {
            force: true,
            subjectType: "drag-n-drop",
            events: ["dragenter", "drop"]
          });

        // The script should have printed the contents of the first files
        // into an st.text. (This tests that the upload actually went
        // through.)
        cy.get(".uploadedFileName").should("have.text", fileName1);
        cy.get("[data-testid='stText']")
          .eq(uploaderIndex)
          .should("contain.text", file1);

        cy.get("[data-testid='stMarkdownContainer']")
          .eq(uploaderIndex)
          .should("contain.text", "True");

        cy.get("[data-testid='stFileUploader']")
          .eq(uploaderIndex)
          .matchThemedSnapshots("single_file_uploader-uploaded");

        // Upload a second file. This one will replace the first.
        cy.get("[data-testid='stFileUploadDropzone']")
          .eq(uploaderIndex)
          .attachFile(files[1], {
            force: true,
            subjectType: "drag-n-drop",
            events: ["dragenter", "drop"]
          });

        cy.get(".uploadedFileName")
          .should("have.text", fileName2)
          .should("not.have.text", fileName1);
        cy.get("[data-testid='stText']")
          .eq(uploaderIndex)
          .should("contain.text", file2)
          .should("not.contain.text", file1);

        cy.get("[data-testid='stMarkdownContainer']")
          .eq(uploaderIndex)
          .should("contain.text", "True");

        // On rerun, make sure file is still returned
        cy.get("body").type("r");
        cy.wait(1000);
        cy.get("[data-testid='stText']")
          .eq(uploaderIndex)
          .should("contain.text", file2);

        // Can delete
        cy.get("[data-testid='fileDeleteBtn'] button")
          .eq(uploaderIndex)
          .click();
        cy.get("[data-testid='stText']")
          .eq(uploaderIndex)
          .should("contain.text", "No upload");
      });
    });
  });

  it("uploads and deletes multiple files quickly", () => {
    const fileName1 = "file1.txt";
    const fileName2 = "file2.txt";
    const uploaderIndex = 1;

    // Yes, this is the recommended way to load multiple fixtures
    // in Cypress (!!) using Cypress.Promise.all is buggy. See:
    // https://github.com/cypress-io/cypress-example-recipes/blob/master/examples/fundamentals__fixtures/cypress/integration/multiple-fixtures-spec.js
    // Why can’t I use async / await?
    // https://docs.cypress.io/guides/core-concepts/introduction-to-cypress.html#Commands-Are-Asynchronous
    cy.fixture(fileName1).then(file1 => {
      cy.fixture(fileName2).then(file2 => {
        const files = [
          { fileContent: file1, fileName: fileName1, mimeType: "text/plain" },
          { fileContent: file2, fileName: fileName2, mimeType: "text/plain" }
        ];

        cy.get("[data-testid='stFileUploadDropzone']")
          .eq(uploaderIndex)
          .attachFile(files[0], {
            force: true,
            subjectType: "drag-n-drop",
            events: ["dragenter", "drop"]
          });

        cy.get(".uploadedFileName").each(uploadedFileName => {
          cy.get(uploadedFileName).should("have.text", fileName1);
        });

        cy.get("[data-testid='stFileUploadDropzone']")
          .eq(uploaderIndex)
          .attachFile(files[1], {
            force: true,
            subjectType: "drag-n-drop",
            events: ["dragenter", "drop"]
          });

        // Wait for the HTTP request to complete
        cy.wait("@uploadFile");

        // The widget should show the names of the uploaded files in reverse
        // order
        const filenames = [fileName2, fileName1];
        cy.get(".uploadedFileName").each((uploadedFileName, index) => {
          cy.get(uploadedFileName).should("have.text", filenames[index]);
        });

        // The script should have printed the contents of the two files
        // into an st.text. (This tests that the upload actually went
        // through.)
        const content = [file1, file2].join("\n");
        cy.get("[data-testid='stText']")
          .eq(uploaderIndex)
          .should("have.text", content);

        cy.get("[data-testid='stFileUploader']")
          .eq(uploaderIndex)
          .matchThemedSnapshots("multi_file_uploader-uploaded");

        // Delete the second file. The second file is on top because it was
        // most recently uploaded. The first file should still exist.
        cy.get("[data-testid='fileDeleteBtn'] button")
          .first()
          .click();
        cy.get("[data-testid='stText']")
          .eq(uploaderIndex)
          .should("contain.text", file1);
        cy.get("[data-testid='stMarkdownContainer']")
          .eq(uploaderIndex)
          .should("contain.text", "True");
      });
    });
  });

  // NOTE: This test is essentially identical to the one above. The only
  // difference is that we add a short delay to uploading the two files to
  // ensure that two script runs happen separately (sufficiently rapid widget
  // changes will often be batched into a single script run) to test for the
  // failure mode in https://github.com/streamlit/streamlit/issues/3531.
  it("uploads and deletes multiple files slowly", () => {
    const fileName1 = "file1.txt";
    const fileName2 = "file2.txt";
    const uploaderIndex = 1;

    // Yes, this is the recommended way to load multiple fixtures
    // in Cypress (!!) using Cypress.Promise.all is buggy. See:
    // https://github.com/cypress-io/cypress-example-recipes/blob/master/examples/fundamentals__fixtures/cypress/integration/multiple-fixtures-spec.js
    // Why can’t I use async / await?
    // https://docs.cypress.io/guides/core-concepts/introduction-to-cypress.html#Commands-Are-Asynchronous
    cy.fixture(fileName1).then(file1 => {
      cy.fixture(fileName2).then(file2 => {
        const files = [
          { fileContent: file1, fileName: fileName1, mimeType: "text/plain" },
          { fileContent: file2, fileName: fileName2, mimeType: "text/plain" }
        ];

        cy.get("[data-testid='stFileUploadDropzone']")
          .eq(uploaderIndex)
          .attachFile(files[0], {
            force: true,
            subjectType: "drag-n-drop",
            events: ["dragenter", "drop"]
          });

        cy.get(".uploadedFileName").each(uploadedFileName => {
          cy.get(uploadedFileName).should("have.text", fileName1);
        });

        cy.wait(1000);

        cy.get("[data-testid='stFileUploadDropzone']")
          .eq(uploaderIndex)
          .attachFile(files[1], {
            force: true,
            subjectType: "drag-n-drop",
            events: ["dragenter", "drop"]
          });

        // Wait for the HTTP request to complete
        cy.wait("@uploadFile");

        // The widget should show the names of the uploaded files in reverse
        // order
        const filenames = [fileName2, fileName1];
        cy.get(".uploadedFileName").each((uploadedFileName, index) => {
          cy.get(uploadedFileName).should("have.text", filenames[index]);
        });

        // The script should have printed the contents of the two files
        // into an st.text. (This tests that the upload actually went
        // through.)
        const content = [file1, file2].join("\n");
        cy.get("[data-testid='stText']")
          .eq(uploaderIndex)
          .should("have.text", content);

        // Delete the second file. The second file is on top because it was
        // most recently uploaded. The first file should still exist.
        cy.get("[data-testid='fileDeleteBtn'] button")
          .first()
          .click();
        cy.get("[data-testid='stText']")
          .eq(uploaderIndex)
          .should("contain.text", file1);
        cy.get("[data-testid='stMarkdownContainer']")
          .eq(uploaderIndex)
          .should("contain.text", "True");
      });
    });
  });

  it("works inside st.form()", () => {
    const fileName1 = "file1.txt";
    const uploaderIndex = 2;

    cy.fixture(fileName1).then(file1 => {
      const files = [
        { fileContent: file1, fileName: fileName1, mimeType: "text/plain" }
      ];

      cy.get("[data-testid='stFileUploadDropzone']")
        .eq(uploaderIndex)
        .attachFile(files[0], {
          force: true,
          subjectType: "drag-n-drop",
          events: ["dragenter", "drop"]
        });

      // Wait for the HTTP request to complete
      cy.wait("@uploadFile");

      // We should be showing the uploaded file name
      cy.get(".uploadedFileName").should("have.text", fileName1);

      // But our uploaded text should contain nothing yet, as we haven't
      // submitted.
      cy.get("[data-testid='stText']")
        .eq(uploaderIndex)
        .should("contain.text", "No upload");

      // Submit the form
      cy.get("[data-testid='stFormSubmitButton'] button").click();

      // Now we should see the file's contents
      cy.get("[data-testid='stText']")
        .eq(uploaderIndex)
        .should("contain.text", file1);

      // Press the delete button. Again, nothing should happen - we
      // should still see the file's contents.
      cy.get("[data-testid='fileDeleteBtn'] button")
        .first()
        .click();

      cy.get("[data-testid='stText']")
        .eq(uploaderIndex)
        .should("contain.text", file1);

      // Submit again. Now the file should be gone.
      cy.get("[data-testid='stFormSubmitButton'] button").click();

      cy.get("[data-testid='stText']")
        .eq(uploaderIndex)
        .should("contain.text", "No upload");
    });
  });
});
