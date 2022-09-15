/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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

describe("st.multiselect when testing max_selections through session state", () => {
    beforeEach(() => {
        cy.loadApp("http://localhost:3000/");

        cy.get(".stMultiSelect").then(el => {
            return cy
              .wrap(el)
              .find("input")
              .click()
              .get("li")
              .first()
              .click()
          });
    });
    it("should throw an exception when options > maxSelections is set from session state", () => {
      cy.get(".element-container .stException").should(
        "contain.text",
        `Multiselect has 2 options selected but max_selections\nis set to 1. This happened because you manipulated\nthe widget's state through st.session_state. Note that this\nhappened before the line indicated in the traceback.\nPlease select at most 1 options.`
      );
    });
  })