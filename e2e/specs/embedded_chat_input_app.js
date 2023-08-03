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

describe("embedded app with chat input", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/?embed=true");

    cy.prepForElementSnapshots();
  });

  it("uses the correct bottom padding", () => {
    cy.get(".main .block-container").should(
      "have.css",
      "padding-bottom",
      "160px" // == 10rem
    );
  });

  it("uses the correct top padding", () => {
    cy.get(".main .block-container").should(
      "have.css",
      "padding-top",
      "16px" // == 1rem
    );
  });

  it("not have an iframe resizer anchor", () => {
    cy.get(`[data-testid="IframeResizerAnchor"]`).should("not.exist");
  });
});
