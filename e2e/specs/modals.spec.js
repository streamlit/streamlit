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
  });

  it("displays settings modal correctly", () => {
    cy.get("#MainMenu > button").click();

    cy.get('[data-testid="main-menu-list"] > ul').eq(1).click();

    cy.get("div[role='dialog']").matchThemedSnapshots(
      "settings"
    );
  });
});
