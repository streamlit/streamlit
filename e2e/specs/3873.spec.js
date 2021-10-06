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

describe("checkbox state update regression", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");
  });

  it("initial state", () => {
    cy.get(".stCheckbox").should("have.length", 2);
    cy.get("[role='checkbox']")
      .eq(0)
      .should("be.checked");
    cy.get("[role='checkbox']")
      .eq(1)
      .should("not.be.checked");
  });

  it("checking one disables the other", () => {
    cy.get("[role='checkbox']")
      .eq(1)
      .click();
    cy.get("[role='checkbox']")
      .eq(0)
      .should("not.be.checked");
    cy.get("[role='checkbox']")
      .eq(1)
      .should("be.checked");
  });
});
