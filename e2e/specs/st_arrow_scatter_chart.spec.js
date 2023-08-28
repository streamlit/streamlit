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

describe("st._arrow_scatter_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays a scatterplot chart", () => {
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']")
      .find("canvas")
      .first()
      .should("have.css", "height", "350px");
  });

  it("displays all scatterplot-chart combinations correctly", () => {
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']").should(
      "have.length",
      5
    );

    const getChart = (index) => (
      cy.get(".element-container [data-testid='stArrowVegaLiteChart']").eq(index)
    );

    getChart(0).matchThemedSnapshots("arrow_scatter_chart_snowpark");
    getChart(1).matchThemedSnapshots("arrow_scatter_chart_no_data");
    getChart(2).matchThemedSnapshots("arrow_scatter_chart_align_color_and_few_sizes");
    getChart(3).matchThemedSnapshots("arrow_scatter_chart_align_color_and_many_sizes");
    getChart(4).matchThemedSnapshots("arrow_scatter_chart_align_quant_color_and_size");
  });
});
