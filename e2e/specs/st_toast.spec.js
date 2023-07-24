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

const themes = [ "light", "dark" ]

describe("st.toast", () => {
    before(() => {
        cy.loadApp("http://localhost:3000/");
    });

    beforeEach(() => {
        // Rerun the script before each test so snapshots have sufficient time
        cy.get("body").type("r");
        cy.waitForScriptFinish()
        cy.get("[data-testid='stToast']").should("have.length", 2)
    });

    themes.forEach( theme => {
        it(`displays default toast correctly - ${theme}`, () => {
            if (theme === 'dark') {
                cy.changeTheme('Dark')
                cy.get("body").type("r");
                cy.waitForScriptFinish()
                cy.get("[data-testid='stToast']").should("have.length", 2)
            }

            cy.getIndexed("[data-testid='stMarkdownContainer']", 1)
                .should("contain.text", "This is a default toast message")

            cy.getIndexed("[data-testid='stToast']", 1)
                .matchImageSnapshot(`toast-default-${theme}`);
        });

        it(`displays long message toast correctly - ${theme}`, () => {
            cy.getIndexed("[data-testid='stMarkdownContainer']", 0)
                .should(
                    "contain.text",
                    "Random toast message that is a really really really really really really really long message, going way"
                )

            cy.getIndexed("[data-testid='stToast']", 0)
                .matchImageSnapshot(`toast-long-${theme}`);
        });

        it(`displays expanded long message toast correctly - ${theme}`, () => {
            cy.getIndexed("[data-testid='stToast']", 0).find('.toastViewButton').click();

            cy.getIndexed("[data-testid='stMarkdownContainer']", 0)
                .should(
                    "contain.text",
                    "Random toast message that is a really really really really really really really long message, going way past the 3 line limit"
                );

            cy.getIndexed("[data-testid='stToast']", 0)
                .matchImageSnapshot(`toast-expanded-${theme}`);
        });
    })
});
