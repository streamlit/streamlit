describe("st.file_uploader", () => {
  beforeEach(() => {
    Cypress.Cookies.defaults({
      preserve: ["_xsrf"]
    });
    cy.server();
    cy.route("POST", "**/upload_file").as("uploadFile");

    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("shows widget correctly", () => {
    cy.getIndexed("[data-testid='stFileUploader']", 0).should("exist");
    cy.getIndexed("[data-testid='stFileUploader'] label", 0).should(
      "have.text",
      "Drop a file:"
    );

    cy.getIndexed("[data-testid='stFileUploader']", 0).matchThemedSnapshots(
      "single_file_uploader"
    );

    cy.getIndexed("[data-testid='stFileUploader']", 1).matchThemedSnapshots(
      "disabled_file_uploader"
    );

    cy.getIndexed("[data-testid='stFileUploader']", 2).matchThemedSnapshots(
      "multi_file_uploader"
    );

    cy.getIndexed("[data-testid='stFileUploader']", 4).matchThemedSnapshots(
      "hidden_label_file_uploader"
    );

    cy.getIndexed("[data-testid='stFileUploader']", 5).matchThemedSnapshots(
      "collapsed_label_file_uploader"
    );

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

      cy.getIndexed(
        "[data-testid='stUploadedFileErrorMessage']",
        uploaderIndex
      ).should("have.text", "application/json files are not allowed.");

      cy.getIndexed(
        "[data-testid='stFileUploader']",
        uploaderIndex
      ).matchThemedSnapshots("file_uploader-error");
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

        cy.getIndexed(
          "[data-testid='stFileUploadDropzone']",
          uploaderIndex
        ).attachFile(files[0], {
          force: true,
          subjectType: "drag-n-drop",
          events: ["dragenter", "drop"]
        });

        // The script should have printed the contents of the first files
        // into an st.text. (This tests that the upload actually went
        // through.)
        cy.get(".uploadedFileName").should("have.text", fileName1);
        cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
          "contain.text",
          file1
        );

        cy.getIndexed(
          "[data-testid='stMarkdownContainer']",
          uploaderIndex
        ).should("contain.text", "True");

        cy.getIndexed(
          "[data-testid='stFileUploader']",
          uploaderIndex
        ).matchThemedSnapshots("single_file_uploader-uploaded");

        // Upload a second file. This one will replace the first.
        cy.getIndexed(
          "[data-testid='stFileUploadDropzone']",
          uploaderIndex
        ).attachFile(files[1], {
          force: true,
          subjectType: "drag-n-drop",
          events: ["dragenter", "drop"]
        });

        cy.get(".uploadedFileName")
          .should("have.text", fileName2)
          .should("not.have.text", fileName1);
        cy.getIndexed("[data-testid='stText']", uploaderIndex)
          .should("contain.text", file2)
          .should("not.contain.text", file1);

        cy.getIndexed(
          "[data-testid='stMarkdownContainer']",
          uploaderIndex
        ).should("contain.text", "True");

        // On rerun, make sure file is still returned
        cy.get("body").type("r");
        cy.wait(1000);
        cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
          "contain.text",
          file2
        );

        // Can delete
        cy.getIndexed(
          "[data-testid='fileDeleteBtn'] button",
          uploaderIndex
        ).click();
        cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
          "contain.text",
          "No upload"
        );
      });
    });
  });

  it("uploads and deletes multiple files quickly", () => {
    const fileName1 = "file1.txt";
    const fileName2 = "file2.txt";
    const uploaderIndex = 2;

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

        cy.getIndexed(
          "[data-testid='stFileUploadDropzone']",
          uploaderIndex
        ).attachFile(files[0], {
          force: true,
          subjectType: "drag-n-drop",
          events: ["dragenter", "drop"]
        });

        cy.get(".uploadedFileName").each(uploadedFileName => {
          cy.get(uploadedFileName).should("have.text", fileName1);
        });

        cy.getIndexed(
          "[data-testid='stFileUploadDropzone']",
          uploaderIndex
        ).attachFile(files[1], {
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
        cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
          "have.text",
          content
        );

        cy.getIndexed(
          "[data-testid='stFileUploader']",
          uploaderIndex
        ).matchThemedSnapshots("multi_file_uploader-uploaded");

        // Delete the second file. The second file is on top because it was
        // most recently uploaded. The first file should still exist.
        cy.get("[data-testid='fileDeleteBtn'] button")
          .first()
          .click();
        cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
          "contain.text",
          file1
        );
        cy.getIndexed(
          "[data-testid='stMarkdownContainer']",
          uploaderIndex
        ).should("contain.text", "True");
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
    const uploaderIndex = 2;

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

        cy.getIndexed(
          "[data-testid='stFileUploadDropzone']",
          uploaderIndex
        ).attachFile(files[0], {
          force: true,
          subjectType: "drag-n-drop",
          events: ["dragenter", "drop"]
        });

        cy.get(".uploadedFileName").each(uploadedFileName => {
          cy.get(uploadedFileName).should("have.text", fileName1);
        });

        cy.wait(1000);

        cy.getIndexed(
          "[data-testid='stFileUploadDropzone']",
          uploaderIndex
        ).attachFile(files[1], {
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
        cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
          "have.text",
          content
        );

        // Delete the second file. The second file is on top because it was
        // most recently uploaded. The first file should still exist.
        cy.get("[data-testid='fileDeleteBtn'] button")
          .first()
          .click();
        cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
          "contain.text",
          file1
        );
        cy.getIndexed(
          "[data-testid='stMarkdownContainer']",
          uploaderIndex
        ).should("contain.text", "True");
      });
    });
  });

  it("works inside st.form()", () => {
    const fileName1 = "file1.txt";
    const uploaderIndex = 3;

    cy.fixture(fileName1).then(file1 => {
      const files = [
        { fileContent: file1, fileName: fileName1, mimeType: "text/plain" }
      ];

      cy.getIndexed(
        "[data-testid='stFileUploadDropzone']",
        uploaderIndex
      ).attachFile(files[0], {
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
      cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
        "contain.text",
        "No upload"
      );

      // Submit the form
      cy.get("[data-testid='stFormSubmitButton'] button").click();

      // Now we should see the file's contents
      cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
        "contain.text",
        file1
      );

      // Press the delete button. Again, nothing should happen - we
      // should still see the file's contents.
      cy.get("[data-testid='fileDeleteBtn'] button")
        .first()
        .click();

      cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
        "contain.text",
        file1
      );

      // Submit again. Now the file should be gone.
      cy.get("[data-testid='stFormSubmitButton'] button").click();

      cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
        "contain.text",
        "No upload"
      );
    });
  });

  // regression test for https://github.com/streamlit/streamlit/issues/4256 bug
  it("does not call a callback when not changed", () => {
    const fileName1 = "file1.txt";
    const uploaderIndex = 6;

    cy.fixture(fileName1).then(file1 => {
      const files = [
        { fileContent: file1, fileName: fileName1, mimeType: "text/plain" }
      ];

      // Script contains counter variable stored in session_state with
      // default value 0. We increment counter inside file_uploader callback
      // Since callback did not called at this moment, counter value should
      // be equal 0
      cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
        "contain.text",
        "0"
      );

      // Uploading file, should invoke on_change call and counter increment
      cy.getIndexed(
        "[data-testid='stFileUploadDropzone']",
        uploaderIndex
      ).attachFile(files[0], {
        force: true,
        subjectType: "drag-n-drop",
        events: ["dragenter", "drop"]
      });

      // Make sure callback called
      cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
        "contain.text",
        "1"
      );

      // On rerun, make sure callback is not called, since file not changed
      cy.get("body").type("r");
      cy.wait(1000);

      // Counter should be still equal 1
      cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
        "contain.text",
        "1"
      );
    });
  });
});
