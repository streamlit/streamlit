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
describe("Iframed Streamlit", () => {
  before(() => {
    cy.visit("cypress/assets/iframed_streamlit.html");

    cy.get("iframe").should("have.length", 3);
  });

  it("renders an embedded iframe correctly and expands", () => {
    cy.get("iframe")
      .first()
      .iframe(() => {
        cy.get(".stSlider").should("have.length", 1);
        cy.prepForElementSnapshots();
      });

    cy.get("iframe").first().matchImageSnapshot("embedded_iframe");

    cy.get("iframe")
      .first()
      .iframe(() => {
        // trigger click in the center of the slider
        cy.get('.stSlider [role="slider"]').parent().click();
        // Wait for all the elements to be rendered
        cy.get(".stMarkdown").should("have.length", 10);
      });

    cy.get("iframe").first().matchImageSnapshot("embedded_iframe_expanded");
  });

  it("renders an unembedded iframe correctly and expands", () => {
    cy.get("iframe")
      .eq(1)
      .iframe(() => {
        cy.get(".stSlider").should("have.length", 1);
        cy.prepForElementSnapshots();
      });

    cy.get("iframe").eq(1).matchImageSnapshot("unembedded_iframe");

    cy.get("iframe")
      .eq(1)
      .iframe(() => {
        // trigger click in the center of the slider
        cy.get('.stSlider [role="slider"]').parent().click();
        // Wait for all the elements to be rendered
        cy.get(".stMarkdown").should("have.length", 10);
      });

    cy.get("iframe").eq(1).matchImageSnapshot("unembedded_iframe_expanded");
  });

  it("renders an unembedded iframe with a min height correctly and expands", () => {
    cy.get("iframe")
      .eq(2)
      .iframe(() => {
        cy.get(".stSlider").should("have.length", 1);
        cy.prepForElementSnapshots();
      });

    cy.get("iframe")
      .eq(2)
      .matchImageSnapshot("unembedded_iframe_with_min_height");

    cy.get("iframe")
      .eq(2)
      .iframe(() => {
        // trigger click in the center of the slider
        cy.get('.stSlider [role="slider"]').parent().click();
        // Wait for all the elements to be rendered
        cy.get(".stMarkdown").should("have.length", 10);
      });

    cy.get("iframe")
      .eq(2)
      .matchImageSnapshot("unembedded_iframe_with_min_height_expanded");
  });
});
