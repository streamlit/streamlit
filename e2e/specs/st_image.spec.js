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

describe("st.image", () => {
  before(() => {
    // Increasing timeout since we're waiting for the GIF to load.
    Cypress.config("defaultCommandTimeout", 10000);
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays an image", () => {
    cy.get(".element-container [data-testid='stImage'] img")
      .should("have.css", "height", "100px")
      .should("have.css", "width", "100px");
  });

  it("displays a caption", () => {
    cy.get(
      ".element-container [data-testid='stImage'] [data-testid='caption']"
    )
      .should("contain", "Black Square")
      .should("have.css", "width", "100px");
  });

  it("displays the image and caption together", () => {
    cy.get(".element-container [data-testid='stImage']")
      .eq(0)
      .matchImageSnapshot("image-with-caption");
  });

  it("displays a JPEG image when specified", () => {
    cy.get(".element-container [data-testid='stImage'] img")
      .eq(0)
      .should("have.attr", "src")
      .should("match", /^.*\.jpg$/);
  });

  it("displays a PNG image when specified", () => {
    cy.getIndexed(".element-container [data-testid='stImage'] img", 1)
      .should("have.attr", "src")
      .should("match", /^.*\.png$/);
  });

  it("displays a JPEG image when not specified with no alpha channel", () => {
    cy.getIndexed(".element-container [data-testid='stImage'] img", 2)
      .should("have.attr", "src")
      .should("match", /^.*\.jpg$/);
  });

  it("displays a PNG image when not specified with alpha channel", () => {
    cy.getIndexed(".element-container [data-testid='stImage'] img", 3)
      .should("have.attr", "src")
      .should("match", /^.*\.png$/);
  });

  it("displays a 100x100 image when use_column_width is default, 'auto', 'never', or False", () => {
    for (const index of [4, 5, 6, 7]) {
      cy.getIndexed(
        ".element-container [data-testid='stImage'] img",
        index
      ).matchImageSnapshot("black-square-100px");
    }
  });

  it("displays a column-width image when use_column_width is 'always', True, or size > column", () => {
    for (const index of [8, 9, 10]) {
      cy.getIndexed(
        ".element-container [data-testid='stImage'] img",
        index
      ).matchImageSnapshot(`black-square-column-${index}`);
    }
  });

  it("displays SVG images that load external images", () => {
    cy.get("[data-testid='stImage'] svg")
      .eq(0)
      .matchImageSnapshot("karriebear-avatar");
  });

  it("displays links in text as text", () => {
    cy.getIndexed("[data-testid='stImage'] svg", 1).should(
      "contain",
      "avatars.githubusercontent"
    );
  });

  it("displays SVG tags prefixed with meta xml tags", () => {
    cy.getIndexed("[data-testid='stImage'] svg", 2).should(
      "contain",
      "I am prefixed with some meta tags"
    );
  });

  it("displays a GIF image", () => {
    cy.getIndexed(".element-container [data-testid='stImage'] img", 11)
      .should("have.css", "height", "100px")
      .should("have.css", "width", "100px")
      .should("have.attr", "src")
      .should("match", /^.*\.gif$/);
  });

  it("displays a GIF image and a caption together", () => {
    cy.get(".element-container [data-testid='stImage']")
      .eq(12)
      .matchImageSnapshot("gif-with-caption");
  });

  it("displays a GIF as PNG", () => {
    cy.getIndexed(".element-container [data-testid='stImage'] img", 13)
      .should("have.attr", "src")
      .should("match", /^.*\.png$/);
  });
});
