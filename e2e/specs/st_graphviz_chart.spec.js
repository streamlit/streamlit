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

describe("st.graphviz_chart", () => {
  const getFirstGraphSVG = () => cy.getIndexed(".stGraphVizChart > svg", 0);

  before(() => {
    cy.loadApp("http://localhost:3000/");
    // Running status widget often concludes before charts loaded
    // Add timeout until charts are no longer loading
    cy.get('.stAlert', { timeout: 15000 }).should('not.exist');
    cy.prepForElementSnapshots();
  });

  beforeEach(() => {
    return cy
      .get(".stGraphVizChart > svg > g > title")
      .should("have.length", 5);
  });

  it("shows left and right graph", () => {
    cy.getIndexed(".stGraphVizChart > svg > g > title", 3).should("contain", "Left");
    cy.getIndexed(".stGraphVizChart > svg > g > title", 4).should("contain", "Right");
  });

  it("shows first graph with correct width and height", () => {
    getFirstGraphSVG().should("have.attr", "width", "79pt")
      .and("have.attr", "height", "116pt");
  });

  it("shows first graph in fullscreen", () => {
    cy.get('div[class*="StyledFullScreenFrame"] > [data-testid="StyledFullScreenButton"]').click({ force: true });
    cy.getIndexed(".stGraphVizChart > svg", 0)
      .should("have.attr", "width", "100%")
      .and("have.attr", "height", "100%")
      .matchThemedSnapshots("graphviz-chart-fullscreen");
  });

  it("shows first graph with correct size after exiting fullscreen", () => {
    cy.getIndexed("[data-testid='StyledFullScreenButton']", 0).click();
    getFirstGraphSVG().should("have.attr", "width", "79pt")
      .and("have.attr", "height", "116pt")
      .matchThemedSnapshots("graphviz-chart");
  });
});
