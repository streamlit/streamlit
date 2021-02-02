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

describe("reuse widget label", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000/");
  });

  it("reuses a widget label for different widget types", () => {
    cy.get('.stSlider [role="slider"]').should("exist");

    cy.get(".stSelectbox").should("not.exist");

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "value 1: 25");

    // Trigger click in the center of the slider so that
    // the widget state for the label gets a value, which
    // is of a different type than the value for the selectbox
    cy.get('.stSlider [role="slider"]')
      .first()
      .parent()
      .click();

    cy.get(".stSelectbox").should("exist");

    cy.get('.stSlider [role="slider"]').should("not.exist");

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "value 1: f");
  });
});
