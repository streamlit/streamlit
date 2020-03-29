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

describe("Dataframe format", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  beforeEach(() => {
    cy.get(".element-container .stDataFrame")
      .find(".dataframe.data")
      .as("cells");
  });

  it("correctly formats the first cell", () => {
    cy.get("@cells")
      .first()
      .should("have.text", "3.14");
  });

  it("correctly formats the last cell", () => {
    cy.get("@cells")
      .last()
      .should("have.text", "3.10");
  });
});
