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

const INCREMENTS_PER_DISCONNECT = 5;
const NUM_DISCONNECTS = 20;

describe("websocket reconnects", () => {
  beforeEach(() => {
    Cypress.Cookies.defaults({
      preserve: ["_xsrf"],
    });
    cy.server();
    cy.route("PUT", "**/upload_file/**").as("uploadFile");

    cy.loadApp("http://localhost:3000/");
  });

  it("retains session state when the websocket connection is dropped and reconnects", () => {
    let expectedCount = 0;

    for (let i = 0; i < NUM_DISCONNECTS; i++) {
      expectedCount += INCREMENTS_PER_DISCONNECT;

      for (let j = 0; j < INCREMENTS_PER_DISCONNECT; j++) {
        cy.get(".stButton button").contains("click me!").click();
      }

      cy.window().then((win) => {
        setTimeout(() => {
          win.streamlitDebug.disconnectWebsocket();
        }, 100);
      });

      // Wait until we've disconnected.
      cy.get("[data-testid='stStatusWidget']").should(
        "have.text",
        "Connecting"
      );
      // Wait until we've reconnected and rerun the script.
      cy.get("[data-testid='stStatusWidget']").should("not.exist");

      cy.get(".stMarkdown").contains(`count: ${expectedCount}`);
    }
  });

  it("retains uploaded files when the websocket connection is dropped and reconnects", () => {
    const fileName1 = "file1.txt";
    const uploaderIndex = 0;

    cy.fixture(fileName1).then((file1) => {
      cy.getIndexed(
        "[data-testid='stFileUploadDropzone']",
        uploaderIndex
      ).attachFile(
        {
          fileContent: file1,
          fileName: fileName1,
          mimeType: "text/plain",
        },
        {
          force: true,
          subjectType: "drag-n-drop",
          events: ["dragenter", "drop"],
        }
      );

      cy.wait("@uploadFile");

      // The script should have printed the contents of the first files
      // into an st.text. (This tests that the upload actually went
      // through.)
      cy.get(".uploadedFileName").should("have.text", fileName1);
      cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
        "contain.text",
        file1
      );

      cy.window().then((win) => {
        setTimeout(() => {
          win.streamlitDebug.disconnectWebsocket();
        }, 100);
      });

      // Wait until we've disconnected.
      cy.get("[data-testid='stStatusWidget']").should(
        "have.text",
        "Connecting"
      );
      // Wait until we've reconnected and rerun the script.
      cy.get("[data-testid='stStatusWidget']").should("not.exist");

      // Confirm that our uploaded file is still there.
      cy.getIndexed("[data-testid='stText']", uploaderIndex).should(
        "contain.text",
        file1
      );
    });
  });

  it("retains captured pictures when the websocket connection is dropped and reconnects", { retries: { runMode: 1 } }, () => {
    // Be generous with some of the timeouts in this test as uploading and
    // rendering images can be quite slow.
    const timeout = 30000;

    cy.get("[data-testid='stCameraInputButton']", { timeout })
      .should("have.length", 1)
      .first()
      .wait(1000)
      .should("not.be.disabled")
      .contains("Take Photo")
      .click();

    cy.wait("@uploadFile", { timeout });

    cy.get("img").should("have.length.at.least", 2);

    cy.get("[data-testid='stImage']", { timeout }).should(
      "have.length.at.least",
      1
    );

    cy.window().then((win) => {
      setTimeout(() => {
        win.streamlitDebug.disconnectWebsocket();
      }, 100);
    });

    // Wait until we've disconnected.
    cy.get("[data-testid='stStatusWidget']").should("have.text", "Connecting");
    // Wait until we've reconnected and rerun the script.
    cy.get("[data-testid='stStatusWidget']").should("not.exist");

    // Confirm that our picture is still there.
    cy.get("[data-testid='stImage']").should("have.length.at.least", 1);
  });
});
