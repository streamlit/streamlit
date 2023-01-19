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

const NO_OF_BUTTONS = 13
/**
 * Order of CONN_TYPES_BUTTONs matters as they are rendered in order in st_button.py
 */
const CONN_TYPES_BUTTONS = [
    "snowflake",
    "aws_s3",
    "gsheets",
    "bigquery",
    "http_file",
    "custom",
    "huggingface",
    "postgresql",
]

describe("st.button", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("shows default button correctly", () => {
    cy.get(".stButton").should("have.length", NO_OF_BUTTONS);

    cy.get(".stButton")
      .first()
      .matchThemedSnapshots("button-widget");
  });

  it("shows disabled default button correctly", () => {
    cy.get(".stButton").should("have.length", NO_OF_BUTTONS);

    cy.getIndexed(".stButton", 1).matchThemedSnapshots("disabled-button");
  });

  it("shows primary button correctly", () => {
    cy.get(".stButton").should("have.length", NO_OF_BUTTONS);

    cy.getIndexed(".stButton", 2).matchThemedSnapshots("primary-button");
  });

  it("shows disabled primary button correctly", () => {
    cy.get(".stButton").should("have.length", NO_OF_BUTTONS);

    cy.getIndexed(".stButton", 3)
      .matchThemedSnapshots("disabled-primary-button");
  });

  it("renders useContainerWidth button correctly", () => {
    cy.get(".stButton").should("have.length", NO_OF_BUTTONS);

    cy.getIndexed(".stButton", 4)
      .matchThemedSnapshots("use-container-width-button");
  });

  it("has correct default values", () => {
    cy.get(".stButton button").should("have.text",
        "button 1" + "button 2" + "button 3" + "button 4" + "button 5" + CONN_TYPES_BUTTONS.join(""));
  });

  it("sets value correctly when user clicks", () => {
    cy.get(".stButton button")
      .first()
      .click();

    cy.get(".stMarkdown").contains("value: True");
    cy.get(".stMarkdown").contains("value from state: True");
  });

  it("doesn't reset the value when user clicks again", () => {
    cy.get(".stButton button")
      .first()
      .click()
      .click();

    cy.get(".stMarkdown")
      .first()
      .contains("value: True");
  });

  it("calls callback when clicked", () => {
    cy.get(".stMarkdown").contains("Button was clicked: False");

    cy.get(".stButton button")
      .first()
      .click();

    cy.get(".stMarkdown", { timeout: 10000 }).should("have.length", 9);
    cy.get(".stMarkdown").contains("Button was clicked: True");
    cy.get(".stMarkdown").contains("times clicked: 1");
    cy.get(".stMarkdown").contains("arg value: 1");
    cy.get(".stMarkdown").contains("kwarg value: 2");

    cy.get(".stButton button")
      .first()
      .click();
    cy.get(".stMarkdown").contains("times clicked: 2");

    cy.get(".stButton button")
      .first()
      .click();
    cy.get(".stMarkdown").contains("times clicked: 3");
  });

  it("is reset when user changes another widget", () => {
    cy.get(".stButton button")
      .first()
      .click();
    cy.get(".stMarkdown").contains("value: True");
    cy.get(".stMarkdown").contains("value from state: True");
    cy.get(".stCheckbox").click();

    cy.get(".stMarkdown").contains("value: False");
    cy.get(".stMarkdown").contains("value from state: False");
  });

  it("should show buttons centered, stretched and with centered text inside", () => {
    cy.get("div [data-testid='stVerticalBlock']").each((el, idx) => {
      cy.wrap(el).matchThemedSnapshots(`stretched_buttons_${idx}`);
    });
  });
});
