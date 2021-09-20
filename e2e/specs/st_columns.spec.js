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

describe("st.column", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("creates 2 equal-width columns", () => {
    cy.get("[data-testid='stHorizontalBlock'] [data-testid='stBlock']")
      .eq(0)
      .should("have.css", "flex", "1 1 calc(33.3333% - 16px)");
    cy.get("[data-testid='stHorizontalBlock'] [data-testid='stBlock']")
      .eq(1)
      .should("have.css", "flex", "1 1 calc(33.3333% - 16px)");
    cy.get("[data-testid='stHorizontalBlock'] [data-testid='stBlock']")
      .eq(2)
      .should("have.css", "flex", "1 1 calc(33.3333% - 16px)");
  });

  it("creates 4 variable-width columns", () => {
    cy.get("[data-testid='stHorizontalBlock'] [data-testid='stBlock']")
      .eq(3)
      .should("have.css", "flex", "1 1 calc(10% - 16px)");
    cy.get("[data-testid='stHorizontalBlock'] [data-testid='stBlock']")
      .eq(4)
      .should("have.css", "flex", "1 1 calc(20% - 16px)");
    cy.get("[data-testid='stHorizontalBlock'] [data-testid='stBlock']")
      .eq(5)
      .should("have.css", "flex", "1 1 calc(30% - 16px)");
    cy.get("[data-testid='stHorizontalBlock'] [data-testid='stBlock']")
      .eq(6)
      .should("have.css", "flex", "1 1 calc(40% - 16px)");
  });

  it("does not shift layout on a new element", () => {
    cy.get(".stButton button").click();
    cy.get(".stMarkdown").should("have.text", "Pressed!");

    // This assertion ensures that the report rerun completes first
    cy.get("[data-testid='stHorizontalBlock'] [data-testid='stBlock']").should(
      "have.length",
      7
    );

    // When layout was shifting, there was an old "flex: 8" block here.
    cy.get("[data-testid='stHorizontalBlock'] [data-testid='stBlock']")
      .eq(3)
      .should("have.css", "flex", "1 1 calc(10% - 16px)");
  });
});
