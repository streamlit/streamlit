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

describe("st.map", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    // Wait for all the maps to be loaded.
    cy.get(".element-container .stDeckGlJsonChart").should("have.length", 6);
  });

  it("displays 6 maps", () => {
    cy.get(".element-container .stDeckGlJsonChart").should("have.length", 6)
  });

  it("displays 6 zoom buttons", () => {
    cy.get(".element-container .zoomButton").should("have.length", 6)
  })

  it("warning about data being capped exists", () => {
    cy.get("div [data-testid='stCaptionContainer']")
      .should("have.length", 2)
  })

  it("warning about data being capped has proper message value", () => {
    cy.getIndexed("div [data-testid='stCaptionContainer']", 0)
      .should("contain", "⚠️ Showing only 10k rows. Call collect() on the dataframe to show more.")
    cy.getIndexed("div [data-testid='stCaptionContainer']", 1)
      .should("contain", "⚠️ Showing only 10k rows. Call collect() on the dataframe to show more.")
  })

  it("displays the correct snapshot", () => {
    cy.get(".mapboxgl-canvas")
    // Adding a sufficient wait to ensure the map fully loads before taking the snapshot
    cy.wait(10000)
    cy.get(".element-container", { waitForAnimations: true }).last().matchImageSnapshot("stDeckGlJsonChart")

    // Need to manually change theme vs. matchThemedSnapshot to be able to add wait in right sequence
    cy.changeTheme("Dark")
    cy.wait(10000)
    cy.get(".element-container", { waitForAnimations: true }).last().matchImageSnapshot("stDeckGlJsonChart-dark")
  })

});
