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

describe("label markdown", () => {
    before(() => {
        cy.loadApp("http://localhost:3000/");

        cy.prepForElementSnapshots();
    });

    it("button labels allow bold, italics, strikethrough, emojis, code, & colored text", () => {
        cy.get(".stButton").should("have.length", 3);
        cy.get(".stDownloadButton").should("have.length", 3);

        cy.get(".stButton")
            .first()
            .matchThemedSnapshots("valid_button_markdown");

        cy.get(".stDownloadButton")
            .first()
            .matchThemedSnapshots("valid_download_button_markdown");
    });

    it("button labels do not allow links", () => {
        cy.get(".stButton").should("have.length", 3);
        cy.get(".stDownloadButton").should("have.length", 3);


        cy.get(".stButton")
            .last()
            .matchThemedSnapshots("invalid_button_markdown");

        cy.get(".stDownloadButton")
            .last()
            .matchThemedSnapshots("invalid_download_button_markdown");
    });

    it("checkbox labels allow bold, italics, strikethrough, emojis, links, code, & colored text", () => {
        cy.get(".stCheckbox")
            .first()
            .matchThemedSnapshots("checkbox_markdown");
    });

    // it("expander labels allow bold, italics, strikethrough, emojis, links, code, & colored text", () => {
    //     // Expand widget
    //     cy.get(".streamlit-expanderHeader").click()
    //     cy.get("[data-testid='stExpander']").matchThemedSnapshots("expander_markdown");
    // });

    // it("Handles markdown in widget labels correctly", () => {
    //     // All widget labels should only allow italics, bold, strikethrough, emoji, link, code
    //     cy.get(".stCheckbox")
    //     .matchThemedSnapshots("checkbox_markdown");

    //     cy.get("[data-testid='metric-container']")
    //     .matchThemedSnapshots("metric_markdown");

    //     cy.get(".stRadio")
    //     .matchThemedSnapshots("radio_markdown");

    //     cy.get(".stSelectbox")
    //     .matchThemedSnapshots("selectbox_markdown");
    // });

    // it("Handles markdown in tabs correctly", () => {
    //     // Tab labels same as widget label
    //     cy.get(".stTabs")
    //         .matchThemedSnapshots("tabs_markdown");
    // });
});
