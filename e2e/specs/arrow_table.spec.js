/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

describe("st.arrow_table", () => {
  before(() => {
    cy.visit("http://localhost:3000/")
  })

  beforeEach(() => {
    cy.get(".stTable tr").as("rows")
    cy.get(".stTable th, .stTable td").as("cells")
    cy.get(".stTable thead tr").as("headingRows")
    cy.get(".stTable tbody th").as("headingColumns")
    cy.get(".stTable tbody td").as("data")
  })

  it("displays a table", () => {
    cy.get(".stTable")
  })

  it("checks number of rows", () => {
    cy.get("@rows")
      .its("length")
      .should("eq", 5)
  })

  it("checks number of cells", () => {
    cy.get("@cells")
      .its("length")
      .should("eq", 25)
  })

  it("checks number of heading rows", () => {
    cy.get("@headingRows")
      .its("length")
      .should("eq", 3)
  })

  it("checks number of heading columns", () => {
    cy.get("@headingColumns")
      .its("length")
      .should("eq", 4)
  })

  it("checks UUID", () => {
    cy.get(".stTable table").should("have.id", "T_custom_uuid")
  })

  it("checks caption", () => {
    cy.get(".stTable caption").should("have.text", "The caption")
  })

  it("checks custom styles", () => {
    cy.get(".stTable .blank").each($element => {
      cy.wrap($element).should("have.css", "background-color", "rgb(255, 0, 0)")
    })
  })

  it("checks formatting", () => {
    cy.get("@data").each(($element, index) => {
      cy.wrap($element).should("have.text", index * 100 + ".00%")
    })
  })

  it("highlights maximum", () => {
    cy.get("@data")
      .last()
      .should("have.css", "background-color", "rgb(255, 255, 0)")
  })
})
