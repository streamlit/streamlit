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

describe("st.column", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("creates 2 equal-width columns", () => {
    cy.getIndexed(
      "[data-testid='stHorizontalBlock'] [data-testid='column']",
      0
    ).should("have.css", "flex", "1 1 calc(33.3333% - 16px)");
    cy.getIndexed(
      "[data-testid='stHorizontalBlock'] [data-testid='column']",
      1
    ).should("have.css", "flex", "1 1 calc(33.3333% - 16px)");
    cy.getIndexed(
      "[data-testid='stHorizontalBlock'] [data-testid='column']",
      2
    ).should("have.css", "flex", "1 1 calc(33.3333% - 16px)");
  });

  it("creates 4 variable-width columns", () => {
    cy.getIndexed(
      "[data-testid='stHorizontalBlock'] [data-testid='column']",
      3
    ).should("have.css", "flex", "1 1 calc(10% - 16px)");
    cy.getIndexed(
      "[data-testid='stHorizontalBlock'] [data-testid='column']",
      4
    ).should("have.css", "flex", "1 1 calc(20% - 16px)");
    cy.getIndexed(
      "[data-testid='stHorizontalBlock'] [data-testid='column']",
      5
    ).should("have.css", "flex", "1 1 calc(30% - 16px)");
    cy.getIndexed(
      "[data-testid='stHorizontalBlock'] [data-testid='column']",
      6
    ).should("have.css", "flex", "1 1 calc(40% - 16px)");
  });

  it("does not shift layout on a new element", () => {
    cy.get(".stButton button").click();
    cy.get(".stMarkdown").should("have.text", "Pressed!");

    // This assertion ensures that the report rerun completes first
    cy.get("[data-testid='stHorizontalBlock'] [data-testid='column']").should(
      "have.length",
      16
    );

    // When layout was shifting, there was an old "flex: 8" block here.
    cy.getIndexed(
      "[data-testid='stHorizontalBlock'] [data-testid='column']",
      3
    ).should("have.css", "flex", "1 1 calc(10% - 16px)");
  });

  it("creates small gap between columns", () => {
    cy.getIndexed("[data-testid='stHorizontalBlock']",
    2).matchThemedSnapshots("columns-small-gap");
  });

  it("creates medium gap between columns", () => {
    cy.getIndexed("[data-testid='stHorizontalBlock']",
    3).matchThemedSnapshots("columns-medium-gap");
  });

  it("creates large gap between columns", () => {
    cy.getIndexed("[data-testid='stHorizontalBlock']",
    4).matchThemedSnapshots("columns-large-gap");
  });

});
