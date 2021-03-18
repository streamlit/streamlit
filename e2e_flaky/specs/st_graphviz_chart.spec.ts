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

/// <reference types="cypress" />

describe("st.graphviz_chart", () => {
  before(() => {
    cy.visit("http://localhost:3000/");

    // Make the ribbon decoration line disappear
    cy.get("[data-testid='stDecoration']").invoke("css", "display", "none");
  });

  beforeEach(() => {
    return cy.get(".stGraphVizChart").should("have.length", 3);
  });

  it("displays a graph with two connected nodes", () => {
    cy.get("#graphviz-chart-0 svg").matchThemedSnapshots("graphviz-chart-0");
  });

  it("displays a colorful node within a cluster within a graph", () => {
    cy.get("#graphviz-chart-1 svg").matchThemedSnapshots("graphviz-chart-1");
  });

  it("displays a graph representing a finite state machine", () => {
    cy.get("#graphviz-chart-2 svg").matchThemedSnapshots("graphviz-chart-2");
  });
});
