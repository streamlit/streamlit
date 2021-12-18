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

describe("st.camera_input", () => {
  before(() => {
    Cypress.Cookies.defaults({
      preserve: ["_xsrf"]
    });
    cy.visit("http://localhost:3000/");
  });

  it("displays correct number of elements", () => {
    cy.get("[data-testid='stCameraInput']").should("have.length", 2);
  });

  it("capture photo when 'Take photo' button clicked", () => {
    cy.wait(100);
    cy.get("[data-testid='stCameraInput']")
      .contains("Take Photo")
      .click();
    cy.wait(100);
    cy.get("img").should("have.length", 2);

    cy.get("[data-testid='stImage']").should("have.length", 1);
  });

  it("Remove photo when 'Clear photo' button clicked", () => {
    cy.wait(100);
    cy.get("[data-testid='stCameraInput']")
      .contains("Clear Photo")
      .click();
    cy.wait(100);
    cy.get("[data-testid='stImage']").should("not.exist");
  });
});
