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

/*
 * Disabling widgets have their own spec since we
 * can't run other tests after we kill the server
 */
describe("disable widgets", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("disconnects the client and disables widgets", () => {
    cy.get(".stButton button").should("not.be.disabled");

    cy.get(".stMarkdown").should("have.text", "Value 1: 25");

    cy.window().then((win) => {
      // We shut down the runtime entirely rather than just close the websocket
      // connection as the client will immediately reconnect if we just do the
      // latter.
      win.streamlitDebug.shutdownRuntime();

      cy.get(".stButton button").should("be.disabled");

      cy.get(".stCheckbox input").should("be.disabled");

      cy.get(".stDateInput input").should("be.disabled");

      cy.get(".stRadio input").should("be.disabled");

      cy.get(".stSelectbox input").should("be.disabled");

      cy.get(".stTextArea textarea").should("be.disabled");

      cy.get(".stTextInput input").should("be.disabled");

      cy.get(".stTimeInput input").should("be.disabled");

      // slider doesn't have a `disabled` attribute
      cy.get('.stSlider [role="slider"]').first().parent().click();

      cy.get(".stMarkdown").should("have.text", "Value 1: 25");

      cy.get(".element-container").each((el, i) => {
        return cy.get(el).matchImageSnapshot(`disabled-widgets-${i}`);
      });
    });
  });
});
