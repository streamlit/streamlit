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

import { cyGetIndexed } from "./spec_utils";

describe("st.select_slider", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");
  });

  it("displays correct number of elements", () => {
    cy.get(".element-container .stSlider").should("have.length", 5);
  });

  it("shows labels", () => {
    cyGetIndexed(".stSlider label", 0).should("have.text", "Label 1");

    cyGetIndexed(".stSlider label", 1).should("have.text", "Label 2");

    cyGetIndexed(".stSlider label", 2).should("have.text", "Label 3");

    cyGetIndexed(".stSlider label", 3).should("have.text", "Label 4");

    cyGetIndexed(".stSlider label", 4).should("have.text", "Label 5");
  });

  it("has correct values", () => {
    cyGetIndexed(".stMarkdown", 0).should(
      "have.text",
      "Value 1: ('orange', 'blue')"
    );

    cyGetIndexed(".stMarkdown", 1).should("have.text", "Value 2: 1");

    cyGetIndexed(".stMarkdown", 2).should("have.text", "Value 3: (2, 5)");

    cyGetIndexed(".stMarkdown", 3).should("have.text", "Value 4: 5");

    cyGetIndexed(".stMarkdown", 4).should("have.text", "Value 5: 1");

    cyGetIndexed(".stMarkdown", 5).should(
      "have.text",
      "Select slider changed: False"
    );
  });

  it("has correct aria-valuetext", () => {
    cyGetIndexed('.stSlider [role="slider"]', 0).should(
      "have.attr",
      "aria-valuetext",
      "orange"
    );

    cyGetIndexed('.stSlider [role="slider"]', 1).should(
      "have.attr",
      "aria-valuetext",
      "blue"
    );
  });

  it("increments the value on right arrow key press", () => {
    cyGetIndexed('.stSlider [role="slider"]', 0)
      .click()
      .type("{rightarrow}", { force: true });

    cyGetIndexed(".stMarkdown", 0).should(
      "have.text",
      "Value 1: ('yellow', 'blue')"
    );

    cyGetIndexed('.stSlider [role="slider"]', 0).should(
      "have.attr",
      "aria-valuetext",
      "yellow"
    );

    cyGetIndexed('.stSlider [role="slider"]', 1).should(
      "have.attr",
      "aria-valuetext",
      "blue"
    );
  });

  it("decrements the value on left arrow key press", () => {
    cyGetIndexed('.stSlider [role="slider"]', 0)
      .click()
      .type("{leftarrow}", { force: true });

    cyGetIndexed(".stMarkdown", 0).should(
      "have.text",
      "Value 1: ('red', 'blue')"
    );

    cyGetIndexed('.stSlider [role="slider"]', 0).should(
      "have.attr",
      "aria-valuetext",
      "red"
    );

    cyGetIndexed('.stSlider [role="slider"]', 1).should(
      "have.attr",
      "aria-valuetext",
      "blue"
    );
  });

  it("maintains its state on rerun", () => {
    cyGetIndexed('.stSlider [role="slider"]', 0)
      .click()
      .type("{leftarrow}", { force: true });

    // Rerun the script.
    cy.get(".stApp [data-testid='stDecoration']").trigger("keypress", {
      keyCode: 82, // "r"
      which: 82 // "r"
    });

    cyGetIndexed(".stMarkdown", 0).should(
      "have.text",
      "Value 1: ('red', 'blue')"
    );
  });

  it("calls callback if one is registered", () => {
    // This selects the slider ends, so range sliders have two, and this is the
    // seventh element in the list.
    cyGetIndexed('.stSlider [role="slider"]', 6)
      .click()
      .type("{rightarrow}", { force: true });

    cy.get(".stMarkdown").should(
      "contain.text",
      "Value 5: 2" + "Select slider changed: True"
    );
  });
});
