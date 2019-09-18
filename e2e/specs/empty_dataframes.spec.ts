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

describe("Dataframes", () => {
  const DF_SELECTOR = ".stDataFrame";
  const TABLE_SELECTOR = ".stTable > table";

  before(() => {
    // http://gs.statcounter.com/screen-resolution-stats/desktop/worldwide
    cy.visit("http://localhost:3000/");

    cy.wait(1000);

    // Force our header to scroll with the page, rather than
    // remaining fixed. This prevents us from occasionally getting
    // the little multi-colored ribbon at the top of our screenshots.
    cy.get(".stApp > header").invoke("css", "position", "absolute");
  });

  it("have consistent empty list visuals", () => {
    cy.get(".element-container")
      .eq(1)
      .each(el => {
        cy.wrap(el).matchImageSnapshot();
      });
  });

  it("have consistent empty visuals", () => {
    cy.get(DF_SELECTOR)
      .filter(idx => idx >= 0 && idx <= 5)
      .each(el => {
        cy.wrap(el).matchImageSnapshot();
      });
  });

  it("have consistent empty one-column visuals", () => {
    cy.get(DF_SELECTOR)
      .filter(idx => idx >= 6 && idx <= 7)
      .each(el => {
        // Snapshot the parent instead of `.stDataFrame` so we have a larger
        // bounding box and a lower percentage difference on the snapshot diff
        cy.wrap(el)
          .parent()
          .matchImageSnapshot();
      });
  });

  it("have consistent empty two-column visuals", () => {
    cy.get(DF_SELECTOR)
      .filter(idx => idx >= 8 && idx <= 9)
      .each(el => {
        cy.wrap(el).matchImageSnapshot();
      });
  });

  it("have consistent empty table visuals", () => {
    cy.get(TABLE_SELECTOR)
      .filter(idx => idx >= 0 && idx <= 3)
      .each(el => {
        cy.wrap(el).matchImageSnapshot();
      });
  });

  it("have consistent empty one-column table visuals", () => {
    cy.get(TABLE_SELECTOR)
      .eq(4)
      .each(el => {
        cy.wrap(el).matchImageSnapshot();
      });
  });

  it("have consistent empty two-column table visuals", () => {
    cy.get(TABLE_SELECTOR)
      .eq(5)
      .each(el => {
        cy.wrap(el).matchImageSnapshot();
      });
  });
});
