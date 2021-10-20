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

describe("st._arrow_line_chart_add_rows_special", () => {
  // Increasing timeout since we're waiting for
  // chart to be rendered.
  Cypress.config("defaultCommandTimeout", 30000);

  // Doesn't have to run before each, since these tests are stateless.
  before(() => {
    cy.visit("http://localhost:3000/");

    // Wait until we're not running
    cy.get("[data-testid='stStatusWidget']").should("not.exist");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  it("correctly adds rows to a line chart", () => {
    cy.get("[data-testid='stArrowVegaLiteChart']").matchThemedSnapshots(
      "arrowLineChartAddRows"
    );
  });
});
