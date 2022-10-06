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


  it("displays red circle without width, height, xmlns as svg", () => {
    cy.get(".element-container [data-testid='stImage'] svg circle")
      .eq(0)
      .should("have.attr", "fill")
  });

  it("displays red circle with width, height and xmlns as img", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(0).should("have.attr", "src")
    cy.get(".element-container [data-testid='stImage'] img").eq(0).should("have.attr", "style", "max-width: 100%;")
  });

  it("scales red circle with width, height and xmlns as img", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(1).should("have.attr", "src")
    cy.get(".element-container [data-testid='stImage'] img").eq(1).should("have.attr", "style", "width: 300px;")
  });

  it("displays yellow green rectangle as img", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(2).should("have.attr", "src");
    cy.get(".element-container [data-testid='stImage'] img").eq(2).should("have.attr", "style", "width: 100px;")
  });

  it("scales yellow green rectangle", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(3).should("have.attr", "src");
    cy.get(".element-container [data-testid='stImage'] img").eq(3).should("have.attr", "style", "width: 300px;")
  });

  // rectangle is yellow, which means viewbox is respected
  it("displays yellow rectangle (respects viewbox) as img", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(4).should("have.attr", "src");
    cy.get(".element-container [data-testid='stImage'] img").eq(4).should("have.attr", "style", "width: 100px;")
  });

  it("scales yellow rectangle (respects viewbox)", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(5).should("have.attr", "src");
    cy.get(".element-container [data-testid='stImage'] img").eq(5).should("have.attr", "style", "width: 300px;")
  });

  // rectangle is green, which means viewbox is respected
  it("displays green rectangle (respects viewbox) as img", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(6).should("have.attr", "src");
    cy.get(".element-container [data-testid='stImage'] img").eq(6).should("have.attr", "style", "width: 100px;")
  });

  it("scales green rectangle (respects viewbox)", () => {
    cy.get(".element-container [data-testid='stImage'] img").eq(7).should("have.attr", "src");
    cy.get(".element-container [data-testid='stImage'] img").eq(7).should("have.attr", "style", "width: 300px;")
  });
});
