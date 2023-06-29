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

describe("displays tooltips on text elements properly", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
    cy.prepForElementSnapshots();
  });

  it("Display text properly on tooltips on markdown", () => {
    cy.getIndexed(`.stMarkdown .stTooltipIcon`, 0)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer]").should(
      "contain",
      "This is example tooltip displayed on markdown."
    );
  });

  it("Display text properly on tooltips on text", () => {
    cy.get(`.stTextLabelWrapper > * > .stTooltipIcon`)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer]").should(
      "contain",
      "This is example tooltip displayed on text."
    );
  });

  it("Display text properly on tooltips on latex", () => {
    cy.getIndexed(`.stMarkdown .stTooltipIcon`, 1)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer]").should(
      "contain",
      "This is example tooltip displayed on latex."
    );
  });

  it("Display text properly on tooltips on caption", () => {
    cy.getIndexed(`.stMarkdown .stTooltipIcon`, 2)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer]").should(
      "contain",
      "This is example tooltip displayed on caption."
    );
  });

  it("Display text properly on tooltips on title", () => {
    cy.getIndexed(`.stMarkdown .stTooltipIcon`, 3)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer]").should(
      "contain",
      "This is example tooltip displayed on title."
    );
  });

  it("Display text properly on tooltips on header", () => {
    cy.getIndexed(`.stMarkdown .stTooltipIcon`, 4)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer]").should(
      "contain",
      "This is example tooltip displayed on header."
    );
  });

  it("Display text properly on tooltips on subheader", () => {
    cy.getIndexed(`.stMarkdown .stTooltipIcon`, 5)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer]").should(
      "contain",
      "This is example tooltip displayed on subheader."
    );
  });

  it("Tooltips match image snapshots", () => {
    cy.getIndexed(".stTooltipContent", 0).matchImageSnapshot("stTooltipMarkdown")
    cy.getIndexed(".stTooltipContent", 1).matchImageSnapshot("stTooltipText")
    cy.getIndexed(".stTooltipContent", 2).matchImageSnapshot("stTooltipLatex")
    cy.getIndexed(".stTooltipContent", 3).matchImageSnapshot("stTooltipCaption")
    cy.getIndexed(".stTooltipContent", 4).matchImageSnapshot("stTooltipTitle")
    cy.getIndexed(".stTooltipContent", 5).matchImageSnapshot("stTooltipHeader")
    cy.getIndexed(".stTooltipContent", 6).matchImageSnapshot("stTooltipSubheader")
  })
});
