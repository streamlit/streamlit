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

describe("st.write", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  beforeEach(() => {
    cy.get(".element-container").should("have.length", 3);
  });

  it("displays markdown", () => {
    cy.get(".element-container .stMarkdown p")
      .first()
      .contains("This markdown is awesome! 😎");
  });

  it("escapes HTML", () => {
    cy.get(".element-container .stMarkdown p")
      .eq(1)
      .contains("This <b>HTML tag</b> is escaped!");
  });

  it("allows HTML if defined explicitly", () => {
    cy.get(".element-container .stMarkdown p")
      .last()
      .contains("This HTML tag is not escaped!");
  });
});
