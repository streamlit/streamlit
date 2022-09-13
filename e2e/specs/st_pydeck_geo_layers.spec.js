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

describe("st.pydeck_chart geo layers", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays H3 hexagon layer", () => {
    // NB: #view-default-view needs to be invisible
    // to be able to capture the layer.
    cy.get("#view-default-view").invoke("css", "display", "none");

    cy.get(".element-container .stDeckGlJsonChart")
      .find("#deckgl-overlay")
      .matchThemedSnapshots("h3-hexagon-layer");
  });

  it("checks if layers have tooltip", () => {
    cy.get(".element-container .stDeckGlJsonChart")
      .find(".deck-tooltip")
      .should("exist");
  });
});
