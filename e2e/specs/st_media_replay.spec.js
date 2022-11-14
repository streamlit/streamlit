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

// Audio + video tests, but we rerun the page to ensure everything shows up
// when the value is replayed from the cache

describe("media replay", () => {
  before(() => {
    // Increasing timeout since we're requesting external files
    Cypress.config("defaultCommandTimeout", 10000);
    cy.loadApp("http://localhost:3000/");
  });

  it("displays an audio player", () => {
    cy.get(".element-container .stAudio");
    cy.rerunScript();
    cy.waitForRerun();
    cy.get(".element-container .stAudio");
  });

  it("has audio controls", () => {
    cy.get(".element-container .stAudio").should("have.attr", "controls");
    cy.rerunScript();
    cy.waitForRerun();
    cy.get(".element-container .stAudio").should("have.attr", "controls");
  });

  it("has audio src", () => {
    cy.get(".element-container .stAudio").should("have.attr", "src");
    cy.rerunScript();
    cy.waitForRerun();
    cy.get(".element-container .stAudio").should("have.attr", "src");
  });

  it("has audio", () => {
    cy.get(".element-container .stAudio")
      .should("have.prop", "tagName")
      .and("eq", "AUDIO");
    cy.rerunScript();
    cy.waitForRerun();
    cy.get(".element-container .stAudio")
      .should("have.prop", "tagName")
      .and("eq", "AUDIO");
  });

  it("displays a video player", () => {
    cy.get(".element-container .stVideo").should("have.attr", "src");
    cy.rerunScript();
    cy.waitForRerun();
    cy.get(".element-container .stVideo").should("have.attr", "src");
  });
});
