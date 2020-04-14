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

/// <reference types="cypress" />

describe("st.color_picker", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("shows labels", () => {
    cy.get(".stColorPicker label")
      .first()
      .should("have.text", "Default Color");
  });

  it("displays a color picker", () => {
    cy.get(".stColorPicker .chrome-picker").should("be.visible");
  });

  it("has correct default values", () => {
    cy.get(".stColorPicker .chrome-picker input")
      .first()
      .should("have.value", "#000000");
  });

  it("has renders correct values for both shorthand and complete hex", () => {
    cy.get(".stColorPicker .chrome-picker input")
      .eq(1)
      .should("have.value", "#333333");
    cy.get(".stColorPicker .chrome-picker input")
      .eq(2)
      .should("have.value", "#333333");
  });

  it("handles value changes", () => {
    /* the center color is #80404040 */
    cy.get(".stColorPicker .chrome-picker > div")
      .first()
      .click("center");
    cy.get(".stColorPicker .chrome-picker input")
      .first()
      .should("have.value", "#804040");
  });

  it("shows error message for invalid string", () => {
    cy.get(".element-container")
      .last()
      .should("contain", "StreamlitAPIException");
  });
});
