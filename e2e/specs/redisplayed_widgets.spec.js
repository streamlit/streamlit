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

describe("redisplayed widgets", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");
  });

  it("does not save widget state when widget is removed and redisplayed", () => {
    cy.get(".stCheckbox")
      .eq(0)
      .click();

    cy.wait(1000);

    cy.get(".stCheckbox")
      .eq(1)
      .click();

    cy.wait(1000);

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "hello");

    cy.get(".stCheckbox")
      .eq(0)
      .click();

    cy.wait(1000);

    cy.get(".stCheckbox")
      .eq(0)
      .click();

    cy.contains("hello").should("not.exist");
  });

  it("does not save state when widget is removed and redisplayed if widget is keyed", () => {
    cy.get(".stCheckbox")
      .eq(0)
      .click();

    cy.wait(1000);

    cy.get(".stCheckbox")
      .eq(2)
      .click();

    cy.wait(1000);

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "goodbye");

    cy.get(".stCheckbox")
      .eq(0)
      .click();

    cy.wait(1000);

    cy.get(".stCheckbox")
      .eq(0)
      .click();

    cy.contains("goodbye").should("not.exist");
  });
});
