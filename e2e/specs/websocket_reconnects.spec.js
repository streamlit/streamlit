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

describe("websocket reconnects", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("persists session state when the websocket connection is dropped and reconnects", () => {
    for (let i = 0; i < 5; i++) {
      cy.get(".stButton button").contains("click me!").click();
    }

    cy.window().then((win) => {
      setTimeout(() => {
        win.streamlitDebug.disconnectWebsocket();
      }, 100);

      // Wait until we've disconnected.
      cy.get("[data-testid='stStatusWidget']").should(
        "have.text",
        "Connecting"
      );
      // Wait until we've reconnected and rerun the script.
      cy.get("[data-testid='stStatusWidget']").should("not.exist");

      cy.get(".stMarkdown").contains("count: 5");
    });
  });
});
