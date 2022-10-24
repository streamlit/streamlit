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

describe("widget replay cache selection", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("runs cached function with new widget values", () => {
    cy.get(".stRadio").should("have.length", 1);
    cy.get("[data-testid='stText']").should("have.text", "['function ran']");
    cy.get(".stButton").first.click();
    cy.get(".stRadio").should("have.length", 1);
    cy.get("[data-testid='stText']").should("have.text", "[]");

    cy.get(".stRadio").first().find("input").last().click({ force: true });
    cy.get(".stRadio").should("have.length", 1);
    cy.get("[data-testid='stText']").should("have.text", "['function ran']");
    cy.get(".stButton").first.click();
    cy.get(".stRadio").should("have.length", 1);
    cy.get("[data-testid='stText']").should("have.text", "[]");
  })
})
