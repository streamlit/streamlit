/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

/// <reference types="cypress" />

const columnIndexes = ["", "First Name", "Last Name", "Age"];
const cells = [
  "Jason",
  "Miller",
  "42",
  "Molly",
  "Jacobson",
  "52",
  "Tina",
  "Ali",
  "36",
  "Jake",
  "Milner",
  "24",
  "Amy",
  "Smith",
  "73"
];

function getIframeBody() {
  return cy
    .get(".element-container > iframe")
    .should(iframe => {
      // Wait for a known element of the iframe to exist. In this case,
      // we wait for its table to appear. This will happen after the
      // handshaking with Streamlit is done.
      expect(iframe.contents().find("table")).to.exist;
    })
    .then(iframe => {
      // Return a snapshot of the iframe's body, now that we know it's
      // loaded.
      return cy.wrap(iframe.contents().find("body"));
    });
}

describe("Custom Dataframe template", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  beforeEach(() => {
    // Make the ribbon decoration line disappear.
    cy.get(".decoration").invoke("css", "display", "none");

    getIframeBody()
      .find("table tbody tr")
      .as("rows");
    getIframeBody()
      .find("table tbody td")
      .as("cells");
    getIframeBody()
      .find("table tbody tr th")
      .as("row_indices");
    getIframeBody()
      .find("table thead th")
      .as("column_indices");
  });

  it("displays the table", () => {
    cy.get(".element-container > iframe").should("have.length", 1);
  });

  it("checks the number of row indices", () => {
    cy.get("@row_indices")
      .its("length")
      .should("eq", 5);
  });

  it("checks the number of column_indices", () => {
    cy.get("@column_indices")
      .its("length")
      .should("eq", 4);
  });

  it("checks the number of rows", () => {
    cy.get("@rows")
      .its("length")
      .should("eq", 5);
  });

  it("checks the number of cells", () => {
    cy.get("@cells")
      .its("length")
      .should("eq", 15);
  });

  it("checks column indices content", () => {
    cy.get("@column_indices").each(($element, index) => {
      return cy.wrap($element).should("contain", columnIndexes[index]);
    });
  });

  it("checks row indices content", () => {
    cy.get("@row_indices").each(($element, index) => {
      return cy.wrap($element).should("contain", index);
    });
  });

  it("checks cells content", () => {
    cy.get("@cells").each(($element, index) => {
      return cy.wrap($element).should("contain", cells[index]);
    });
  });

  it("matches snapshot", () => {
    cy.get(".element-container > iframe").matchImageSnapshot("iframe");
  });
});

describe("It returns dataframe correctly", () => {
  before(() => {
    cy.visit("http://localhost:3000/");

    //Wait for iframe to be loaded.
    getIframeBody();
  });

  beforeEach(() => {
    // Make the ribbon decoration line disappear
    cy.get(".decoration").invoke("css", "display", "none");

    cy.get(".element-container .stTable table").as("table");
    cy.get("@table")
      .find("tbody tr")
      .as("rows");
    cy.get("@table")
      .find("tbody td")
      .as("cells");
    cy.get("@table")
      .find("tbody tr th")
      .as("row_indices");
    cy.get("@table")
      .find("thead th")
      .as("column_indices");
  });

  it("displays the table", () => {
    cy.get(".element-container .stTable").should("have.length", 1);
  });

  it("checks the number of row indices", () => {
    cy.get("@row_indices")
      .its("length")
      .should("eq", 5);
  });

  it("checks the number of column indices", () => {
    cy.get("@column_indices")
      .its("length")
      .should("eq", 4);
  });

  it("checks the number of rows", () => {
    cy.get("@rows")
      .its("length")
      .should("eq", 5);
  });

  it("checks the number of cells", () => {
    cy.get("@cells")
      .its("length")
      .should("eq", 15);
  });

  it("checks column indices content", () => {
    cy.get("@column_indices").each(($element, index) => {
      return cy.wrap($element).should("contain", columnIndexes[index]);
    });
  });

  it("checks row indices content", () => {
    cy.get("@row_indices").each(($element, index) => {
      return cy.wrap($element).should("contain", index);
    });
  });

  it("checks cells content", () => {
    cy.get("@cells").each(($element, index) => {
      return cy.wrap($element).should("contain", cells[index]);
    });
  });

  it("matches snapshot", () => {
    cy.get(".element-container .stTable").matchImageSnapshot("returned_table");
  });
});
