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

describe("st.slider", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("has correct initial values", () => {
    cy.get(".stMarkdown", { timeout: 10000 }).should(
      "have.text",
      "Celsius -100.0" + "Fahrenheit -148.0"
    );
  });

  it("updates both sliders when the first is changed", () => {
    // trigger click in the center of the slider
    cy.get('.stSlider [role="slider"]')
      .eq(0)
      .parent()
      .click();
    // Without the wait, the next part fails because the page updating causes
    // the element to detach.
    cy.wait(1000);

    cy.get(".stMarkdown")
      .eq(0)
      .should("have.text", "Celsius 0.0");

    cy.getIndexed(".stMarkdown", 1).should("have.text", "Fahrenheit 32.0");
  });

  it("updates both sliders when the second is changed", () => {
    // 748 is the width of the slider. Asking cypress to click on the "right"
    // side ends up just short of the actual end, so the numbers aren't quite right.
    cy.getIndexed('.stSlider [role="slider"]', 1)
      .parent()
      .click(748, 0, { force: true });
    cy.wait(1000);

    cy.getIndexed(".stMarkdown", 0).should("have.text", "Celsius 100.0");

    cy.getIndexed(".stMarkdown", 1).should("have.text", "Fahrenheit 212.0");
  });

  it("updates when a slider is changed repeatedly", () => {
    cy.getIndexed('.stSlider [role="slider"]', 0)
      .parent()
      .click();
    cy.wait(1000);

    cy.getIndexed(".stMarkdown", 0).should("have.text", "Celsius 0.0");
    cy.getIndexed(".stMarkdown", 1).should("have.text", "Fahrenheit 32.0");

    cy.getIndexed('.stSlider [role="slider"]', 0)
      .parent()
      .click(748, 0, { force: true });

    cy.getIndexed(".stMarkdown", 0).should("have.text", "Celsius 100.0");

    cy.getIndexed(".stMarkdown", 1).should("have.text", "Fahrenheit 212.0");
  });
});
