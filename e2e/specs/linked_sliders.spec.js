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

describe("st.slider", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");
  });

  it("has correct initial values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      "Celsius -100.0" + "Fahrenheit -148.0"
    );
  });

  it("updates both sliders when the first is changed", () => {
    // trigger click in the center of the slider
    cy.get('.stSlider [role="slider"]')
      .first()
      .parent()
      .click();

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "Celsius 0.0");

    cy.get(".stMarkdown")
      .eq(1)
      .should("have.text", "Fahrenheit 32.0");
  });

  it("updates both sliders when the second is changed", () => {
    cy.get('.stSlider [role="slider"]')
      .eq(1)
      .click()
      .type("{rightarrow}", { force: true });

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "Celsius 100.0");

    cy.get(".stMarkdown")
      .eq(1)
      .should("have.text", "Fahrenheit 212.0");
  });
});
