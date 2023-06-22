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

describe("st.chat_message", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
    cy.prepForElementSnapshots();
    // Make the toolbar disappear to not interfere with snapshots (in wide mode)
    cy.get("[data-testid='stToolbar']").invoke("css", "opacity", 0);
  });

  it("renders chat messages correctly", () => {
    cy.get(".stChatMessage").should("have.length", 7);

    cy.get(".stChatMessage").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("chat_message-" + idx);
    });
  });
});
