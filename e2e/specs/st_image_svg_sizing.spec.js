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

describe("st.image", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });


  it("displays red circle without width and height as svg", () => {
    cy.get(".element-container [data-testid='stImage'] svg circle")
      .eq(0)
      .should("have.attr", "fill")
  });

  it("displays red circle with width and height as img", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(0).should("have.attr", "src")
    cy.get(".element-container [data-testid='stImage'] img").eq(0).should("have.attr", "style", "width: 150px;")
    cy.getIndexed(".element-container [data-testid='stImage'] img", 0).matchImageSnapshot(`sg-image-svg-sizing-0`);
  });

  it("scales red circle with width and height as img", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(1).should("have.attr", "src")
    cy.get(".element-container [data-testid='stImage'] img").eq(1).should("have.attr", "style", "width: 200px;")
    cy.getIndexed(".element-container [data-testid='stImage'] img", 1).matchImageSnapshot(`sg-image-svg-sizing-1`);
  });

  it("red circle fits column width", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(2).should("have.attr", "src")
    cy.getIndexed(".element-container [data-testid='stImage'] img", 2).matchImageSnapshot(`sg-image-svg-sizing-2`);
  });

  it("displays yellow green rectangle as img", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(3).should("have.attr", "src");
    cy.get(".element-container [data-testid='stImage'] img").eq(3).should("have.attr", "style", "max-width: 100%;")
    cy.getIndexed(".element-container [data-testid='stImage'] img", 3).matchImageSnapshot(`sg-image-svg-sizing-3`);
  });

  it("scales yellow rectangle and viewbox is respected", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(4).should("have.attr", "src");
    cy.get(".element-container [data-testid='stImage'] img").eq(4).should("have.attr", "style", "width: 300px;")
    cy.getIndexed(".element-container [data-testid='stImage'] img", 4).matchImageSnapshot(`sg-image-svg-sizing-4`);
  });

  it("scales green rectangle and viewbox is respected", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(5).should("have.attr", "src");
    cy.get(".element-container [data-testid='stImage'] img").eq(5).should("have.attr", "style", "width: 300px;")
    cy.getIndexed(".element-container [data-testid='stImage'] img", 5).matchImageSnapshot(`sg-image-svg-sizing-5`);
  });

  it("yellow green rectangle fits column width", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(6).should("have.attr", "src");
    cy.getIndexed(".element-container [data-testid='stImage'] img", 6).matchImageSnapshot(`sg-image-svg-sizing-6`);
  });
});
