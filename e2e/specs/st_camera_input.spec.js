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

describe("st.camera_input", () => {
  before(() => {
    // Increasing timeout since uploading and rendering images can be slow.
    Cypress.config("defaultCommandTimeout", 30000);

    Cypress.Cookies.defaults({
      preserve: ["_xsrf"],
    });
    cy.loadApp("http://localhost:3000/");
  });

  it("displays correct number of elements", () => {
    cy.get("[data-testid='stCameraInput']").should("have.length.at.least", 2);
  });

  it("capture photo when 'Take photo' button clicked", {
    retries: {runMode: 1}
  }, () => {
    // Be generous with some of the timeouts in this test as uploading and
    // rendering images can be quite slow.
    const timeout = 30000;

    cy.get("[data-testid='stCameraInput']")
      .contains("Learn how to allow access.")
      .should("not.exist");

    cy.get("[data-testid='stCameraInputButton']")
      .should("have.length.at.least", 2)
      .first()
      .should("not.be.disabled")

    // Wait until the camera is ready, there some delay even between
    // `onUserMedia` event and camera is ready.
    cy.wait(2000)

    cy.getIndexed("[data-testid='stCameraInputButton']", 0)
      .should("not.be.disabled")
      .contains("Take Photo")
      .click({force: true});

    cy.get("[data-testid='stImage']", {timeout}).should("have.length.at.least", 1);
  });

  it("Remove photo when 'Clear photo' button clicked", () => {
    cy.get("[data-testid='stCameraInput']")
      .should("have.length.at.least", 2)
      .contains("Clear photo")
      .click();
    cy.get("[data-testid='stImage']").should("not.exist");
  });

  it("shows disabled widget correctly", {retries: {runMode: 1}}, () => {
    cy.get("[data-testid='stCameraInput']").should("have.length.at.least", 2);

    cy.getIndexed("[data-testid='stCameraInput']", 1).matchThemedSnapshots("disabled-camera-input");
  });
});
