/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

describe("add lots of data to vega chart", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("updates the x-axis values", () => {
    cy.get("#ReportStatus").contains("Running...");

    cy.get(".stVegaLiteChart").should("have.length", 1);

    cy.get("#ReportStatus").should("not.exist");

    cy.get(".stVegaLiteChart").matchImageSnapshot(
      "vega-updates-x-axis-values"
    );
  });
});
