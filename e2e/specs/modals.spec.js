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

describe("modals", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("displays light settings modal correctly", () => {
    cy.changeTheme("Light");

    cy.get("#MainMenu > button").click();

    cy.getIndexed('[data-testid="main-menu-list"] ul', 2).click();

    cy.getIndexed('div[data-baseweb="modal" div div]').matchImageSnapshot(
      "settings-light"
    );
  });

  it("displays dark settings modal correctly", () => {
    cy.changeTheme("Dark");

    cy.get("#MainMenu > button").click();

    cy.getIndexed('[data-testid="main-menu-list"] ul', 2).click();

    cy.gey('div[data-baseweb="modal" div div]').matchImageSnapshot(
      "settings-dark"
    );
  });
});
