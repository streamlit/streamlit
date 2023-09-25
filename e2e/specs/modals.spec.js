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

describe("modals", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  // Unfortunately, it seems like matchThemedSnapshots doesn't work for modals,
  // and leads to a CypressError: cy.click() failed because this element:
  // <button>...</button> is being covered by another element: <div>...</div>.
  // I assume it's related to how we internally make the theme change in matchThemedSnapshots,
  // so duplicating tests here a bit to make the theme change, and get the screenshot with matchImageSnapshot

  it("renders the light settings dialog correctly", () => {
    cy.get("#MainMenu").click();

    cy.get('[data-testid="main-menu-list"] > ul').eq(1).click({ force: true });

    cy.get("div[role='dialog']").matchImageSnapshot(
      "settings"
    );
  });

  it("renders the light Edit Theme dialog correctly", () => {
    cy.get("#MainMenu").click();

    cy.get('[data-testid="main-menu-list"] > ul').eq(1).click();

    cy.get('[data-testid="edit-theme"] > button').click({ force: true });

    cy.get("div[role='dialog']").matchImageSnapshot(
      "theme"
    );
  });

  it("renders the dark settings dialog correctly", () => {
    cy.changeTheme("Dark");

    cy.get("#MainMenu").click();

    cy.get('[data-testid="main-menu-list"] > ul').eq(1).click({ force: true });

    cy.get("div[role='dialog']").matchImageSnapshot(
      "settings-dark"
    );
  });

  it("renders the dark Edit Theme dialog correctly", () => {
    cy.changeTheme("Dark");

    cy.get("#MainMenu").click();

    cy.get('[data-testid="main-menu-list"] > ul').eq(1).click({ force: true });

    cy.get('[data-testid="edit-theme"] > button').click({ force: true });

    cy.get("div[role='dialog']").matchImageSnapshot(
      "theme-dark"
    );
  });

  it("renders the light screencast dialog correctly", () => {
    cy.get("#MainMenu").click();

    cy.get('[data-testid="main-menu-list"] > ul').eq(3).click({ force: true });

    cy.get("div[role='dialog']").matchImageSnapshot(
      "screencast"
    );
  });

  it("renders the dark screencast dialog correctly", () => {
    cy.changeTheme("Dark");

    cy.get("#MainMenu").click();

    cy.get('[data-testid="main-menu-list"] > ul').eq(3).click({ force: true });

    cy.get("div[role='dialog']").matchImageSnapshot(
      "screencast-dark"
    );
  });

  it("renders the video recorded dialog width correctly", () => {
    // Set viewport to 1280 x 720 so checking dialog width of 80vw (80% * 1280 = 1024px) round number
    cy.viewport(1280, 720)
    cy.get("#MainMenu").click();
    cy.get('[data-testid="main-menu-list"] > ul').eq(3).click({ force: true });
    cy.get('.ModalBody button').click({ force: true });

    cy.wait(4000);
    cy.get("#MainMenu").type("{esc}");

    cy.get("div[role='dialog']").should("have.css", "width", "1024px");
  });

  it("renders the light about dialog correctly", () => {
    cy.get("#MainMenu").click();

    cy.get('[data-testid="main-menu-list"] > ul').eq(4).click({ force: true });

    cy.get("div[role='dialog']").matchImageSnapshot(
      "about"
    );
  });

  it("renders the dark about dialog correctly", () => {
    cy.changeTheme("Dark");

    cy.get("#MainMenu").click();

    cy.get('[data-testid="main-menu-list"] > ul').eq(4).click({ force: true });

    cy.get("div[role='dialog']").matchImageSnapshot(
      "about-dark"
    );
  });

  it("renders the light clear cache dialog correctly", () => {
    cy.get("#MainMenu").type('C')

    cy.get("div[role='dialog']").matchImageSnapshot(
      "cache"
    );
  });

  it("renders the dark clear cache dialog correctly", () => {
    cy.changeTheme("Dark");

    cy.get("#MainMenu").type('C')

    cy.get("div[role='dialog']").matchImageSnapshot(
      "cache-dark"
    );
  });
});
