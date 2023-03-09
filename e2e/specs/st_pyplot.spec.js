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

describe("st.pyplot", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays a pyplot figure", () => {
    cy.get("[data-testid='stImage']")
      .find("img")
      .should("have.attr", "src");
  });

  it("clears the figure on rerun", () => {
    cy.rerunScript();

    // Wait for 'data-stale' attr to go away, so the snapshot looks right.
    cy.get(".element-container")
      .should("have.attr", "data-stale", "false")
      .invoke("css", "opacity", "1");

    cy.prepForElementSnapshots();

    cy.get("[data-testid='stImage'] > img")
      .first()
      .matchImageSnapshot("pyplot-check-if-cleared");
  });

  it("shows deprecation warning", () => {
    cy.get("[data-testid='stImage']")
      .first()
      .closest(".element-container")
      .prev()
      .should("contain", "PyplotGlobalUseWarning");
  });

  it("hides deprecation warning", () => {
    cy.getIndexed("[data-testid='stImage']", 1)
      .closest(".element-container")
      .prev()
      .should("not.contain", "PyplotGlobalUseWarning");
  });

  it("use_container_width=False should display a smaller image", () => {
    // use_container_width=True, so we have a canvas width
    cy.getIndexed("[data-testid='stImage'] > img", 2)
      .invoke('outerWidth').should('be.eq', 1200);

    // use_container_width=False, so we have a smaller image
    cy.getIndexed("[data-testid='stImage'] > img", 3)
      .invoke('outerWidth').should('be.eq', 342);
  });

});
