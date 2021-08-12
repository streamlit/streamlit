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

describe("st.metric", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  describe("Test first metric", () => {
    it("displays the correct label text", () => {
      cy.get("[data-testid='stMetricLabel']")
        .eq(0)
        .should("have.text", " User growth ");
    });

    it("displays the correct value text", () => {
      cy.get("[data-testid='stMetricValue']")
        .eq(0)
        .should("have.text", " 123 ");
    });

    it("displays the correct delta text", () => {
      cy.get("[data-testid='stMetricDelta']")
        .eq(0)
        .should("have.text", " 123 ");
    });
  });

  describe("Test second metric", () => {
    it("displays the correct label text", () => {
      cy.get("[data-testid='stMetricLabel']")
        .eq(1)
        .should("have.text", " S&P 500 ");
    });

    it("displays the correct value text", () => {
      cy.get("[data-testid='stMetricValue']")
        .eq(1)
        .should("have.text", " -4.56 ");
    });

    it("displays the correct delta text", () => {
      cy.get("[data-testid='stMetricDelta']")
        .eq(1)
        .should("have.text", " -50 ");
    });
  });

  describe("Test third metric", () => {
    it("displays the correct metric label text", () => {
      cy.get("[data-testid='stMetricLabel']")
        .eq(2)
        .should("have.text", " Apples I've eaten ");
    });

    it("displays the correct metric value text", () => {
      cy.get("[data-testid='stMetricValue']")
        .eq(2)
        .should("have.text", " 23k ");
    });

    it("displays the correct metric delta text", () => {
      cy.get("[data-testid='stMetricDelta']")
        .eq(2)
        .should("have.text", " -20 ");
    });
  });

  describe("Test the dark and light theme for green up arrow render", () => {
    it("Check Metric Snapshot", () => {
      cy.get('[data-testid="metric-container"]')
        .eq(0)
        .matchThemedSnapshots("metric-container-green");
    });
  });

  describe("Test the dark and light theme for red down arrow render", () => {
    it("Check Metric Snapshot", () => {
      cy.get('[data-testid="metric-container"]')
        .eq(1)
        .matchThemedSnapshots("metric-container-red");
    });
  });

  describe("Test the dark and light theme for gray down arrow render", () => {
    it("Check Metric Snapshot", () => {
      cy.get('[data-testid="metric-container"]')
        .eq(2)
        .matchThemedSnapshots("metric-container-gray");
    });
  });
});
