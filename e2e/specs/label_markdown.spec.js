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
        // Increasing timeout since we are loading a bunch of widgets
        Cypress.config("defaultCommandTimeout", 10000);

        cy.on('uncaught:exception', (err) => {
            // This error can be safely ignored
            // https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded
            expect(err.message).to.include('ResizeObserver loop limit exceeded')

            // return false to prevent the error from failing this test
            return false
          })

        cy.loadApp("http://localhost:3000/");

        cy.prepForElementSnapshots();
    });

    it("button labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "image"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["invalid", "link"],
        ]

        cy.get(".stButton").should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed(".stButton", index).matchThemedSnapshots(`button-${type}-${name}`);
        })
    });

    it("checkbox labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "table"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get(".stCheckbox").should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed(".stCheckbox", index).matchThemedSnapshots(`checkbox-${type}-${name}`);
        })
    });

    it("radio labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "heading1"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get(".stRadio").should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed(".stRadio", index).matchThemedSnapshots(`radio-${type}-${name}`);
        })
    });

    it("selectbox labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "heading2"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get(".stSelectbox").should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed(".stSelectbox", index).matchThemedSnapshots(`selectbox-${type}-${name}`);
        })
    });

    it("multiselect labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "ordered-list"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get(".stMultiSelect").should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed(".stMultiSelect", index).matchThemedSnapshots(`multiselect-${type}-${name}`);
        })
    });

    it("slider & select_slider labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "unordered-list"],
            ["invalid", "task_list"],
            ["valid", "markdown"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "colored"],
            ["valid", "link"],
            ["valid", "link"],
        ]

        // Handles slider & select-slider
        cy.get(".stSlider").should("have.length", 8);

        cases.forEach(([type, name], index) => {
            const even = index % 2 === 0;
            if (even) {
                cy.getIndexed(".stSlider", index).matchThemedSnapshots(`slider-${type}-${name}`);
            } else {
                cy.getIndexed(".stSlider", index).matchThemedSnapshots(`selectSlider-${type}-${name}`);
            }
        })
    });

    it("text_input labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "blockquote"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get(".stTextInput").should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed(".stTextInput", index).matchThemedSnapshots(`textInput-${type}-${name}`);
        })
    });

    it("number_input labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "horizontal-rule"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get(".stNumberInput").should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed(".stNumberInput", index).matchThemedSnapshots(`numberInput-${type}-${name}`);
        })
    });

    it("text_area labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "image"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get(".stTextArea").should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed(".stTextArea", index).matchThemedSnapshots(`textArea-${type}-${name}`);
        })
    });

    it("date_input labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "table"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get(".stDateInput").should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed(".stDateInput", index).matchThemedSnapshots(`dateInput-${type}-${name}`);
        })
    });

    it("time_input labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "heading1"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get(".stTimeInput").should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed(".stTimeInput", index).matchThemedSnapshots(`timeInput-${type}-${name}`);
        })
    });

    it("file_uploader labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "heading2"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get('[data-testid="stFileUploader"]').should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed('[data-testid="stFileUploader"]', index).matchThemedSnapshots(`fileUploader-${type}-${name}`);
        })
    });

    it("color_picker labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "ordered-list"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get('[data-testid="stColorPicker"]').should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed('[data-testid="stColorPicker"]', index).matchThemedSnapshots(`colorPicker-${type}-${name}`);
        })
    });

    it("metric labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "unordered-list"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get('[data-testid="metric-container"]').should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed('[data-testid="metric-container"]', index).matchThemedSnapshots(`metric-${type}-${name}`);
        })
    });

    it("expander labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "task-list"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get("[data-testid='stExpander']").should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed("[data-testid='stExpander']", index).matchThemedSnapshots(`expander-${type}-${name}`);
        })
    });

    it("tab labels handle markdown as expected", () => {
        const cases = [
            ["invalid", "blockquote-and-hr"],
            ["valid", "markdown"],
            ["valid", "colored"],
            ["valid", "link"],
        ]

        cy.get(".stTabs").should("have.length", 4);

        cases.forEach(([type, name], index) => {
            cy.getIndexed(".stTabs", index).matchThemedSnapshots(`tab-${type}-${name}`);
        })
    });
});
