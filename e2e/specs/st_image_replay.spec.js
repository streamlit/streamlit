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

describe("st.image replay", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

  });

  it("displays an image", () => {
    cy.get(".element-container [data-testid='stImage'] img")
      .should("have.css", "height", "100px")
      .should("have.css", "width", "100px");
  });

  it("displays a caption for both calls", () => {
    cy.getIndexed(
      ".element-container [data-testid='stImage'] [data-testid='caption']", 0
    )
      .should("contain", "Black Square")
      .should("have.css", "width", "100px");
    cy.getIndexed(
      ".element-container [data-testid='stImage'] [data-testid='caption']", 1
    )
      .should("contain", "Black Square")
      .should("have.css", "width", "100px");
  });


  it("displays SVG images that load external images", () => {
    cy.getIndexed("[data-testid='stImage'] svg", 0)
      .matchImageSnapshot("karriebear-avatar");

    cy.getIndexed("[data-testid='stImage'] svg", 1)
      .matchImageSnapshot("karriebear-avatar");
  });


  it("displays a GIF image twice", () => {
    cy.getIndexed(".element-container [data-testid='stImage'] img", 4)
      .should("have.css", "height", "100px")
      .should("have.css", "width", "100px")
      .should("have.attr", "src")
      .should("match", /^.*\.gif$/);
    cy.getIndexed(".element-container [data-testid='stImage'] img", 5)
      .should("have.css", "height", "100px")
      .should("have.css", "width", "100px")
      .should("have.attr", "src")
      .should("match", /^.*\.gif$/);
  });

});
