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

describe("kill server", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("disconnects the client", () => {
    cy.get("[data-testid='stConnectionStatus']").should("not.exist");

    cy.window().then((win) => {
      // We shut down the runtime entirely rather than just close the websocket
      // connection as the client will immediately reconnect if we just do the
      // latter.
      win.streamlitDebug.shutdownRuntime();

      cy.get("[data-testid='stConnectionStatus'] label").should(
        "have.text",
        "Connecting"
      );

      // Snapshot `stToolbar` instead of `ConnectionStatus` so we have a larger
      // bounding box and a lower percentage difference on the snapshot diff
      cy.get("[data-testid='stToolbar']").matchThemedSnapshots("disconnected");
    });
  });
});
