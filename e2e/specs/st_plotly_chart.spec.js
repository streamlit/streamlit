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

describe("st.plotly_chart", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  beforeEach(() => {
    cy.get(".element-container").should("have.length", 15);
  });

  it("displays a plotly chart", () => {
    cy.get(".element-container .stPlotlyChart")
      .find(".modebar-btn--logo")
      .should("have.attr", "data-title")
      .and("match", /Produced with Plotly/);
  });

  it("has consistent visuals", () => {
    cy.get(".element-container .stPlotlyChart")
      .each((el, idx) => {
        return cy.wrap(el).matchThemedSnapshots("plotly_chart" + idx);
      })
  });
});
