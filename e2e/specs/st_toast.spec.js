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


describe("st.toasts - Light Theme", () => {
    before(() => {
      cy.loadApp("http://localhost:3000/");

      cy.prepForElementSnapshots();
    });

    beforeEach(() => {
        // Rerun the script before each test so snapshots have sufficient time
        cy.get("body").type("r");
        cy.get("[data-testid='toastContainer'] > div").should("have.length", 5);
    });

    it("displays default toast correctly", () => {
        cy.getIndexed("[data-testid='stMarkdownContainer']", 4)
            .should("contain.text", "This is a default toast message")

        cy.getIndexed("[data-testid='toastContainer'] > div", 4)
            .matchImageSnapshot("toast-default");
    });

    it("displays success toast correctly", () => {
        cy.getIndexed("[data-testid='stMarkdownContainer']", 3)
            .should("contain.text", "This is a success toast message")

        cy.getIndexed("[data-testid='toastContainer'] > div", 3)
            .matchImageSnapshot("toast-success");
    });

    it("displays warning toast correctly", () => {
        cy.getIndexed("[data-testid='stMarkdownContainer']", 2)
            .should("contain.text", "This is a warning toast message")

        cy.getIndexed("[data-testid='toastContainer'] > div", 2)
            .matchImageSnapshot("toast-warning");
    });

    it("displays error toast correctly", () => {
        cy.getIndexed("[data-testid='stMarkdownContainer']", 1)
            .should("contain.text", "This is a error toast message")

        cy.getIndexed("[data-testid='toastContainer'] > div", 1)
            .matchImageSnapshot("toast-error");
    });

    it("displays long message toast correctly", () => {
        cy.getIndexed("[data-testid='stMarkdownContainer']", 0)
            .should(
                "contain.text",
                "Random toast message that is a really really really really really really really long message, going way"
            )

        cy.getIndexed("[data-testid='toastContainer'] > div", 0)
            .matchImageSnapshot("toast-long");
    });

    it("displays expanded long message toast correctly", () => {
        cy.get("[data-testid='toastContainer'] > div").eq(0).find('button').click();

        cy.getIndexed("[data-testid='stMarkdownContainer']", 0)
            .should(
                "contain.text",
                "Random toast message that is a really really really really really really really long message, going way past the 3 line limit"
            );

        cy.getIndexed("[data-testid='toastContainer'] > div", 0)
            .matchImageSnapshot("toast-expanded");
    });
});

describe("st.toasts - Dark Theme", () => {
    before(() => {
      cy.loadApp("http://localhost:3000/");

      cy.changeTheme("Dark");

      cy.prepForElementSnapshots();
    });

    beforeEach(() => {
        // Rerun the script before each test so snapshots have sufficient time
        cy.get("body").type("r");
        cy.get("[data-testid='toastContainer'] > div").should("have.length", 5);
    });

    it("displays default toast correctly", () => {
        cy.getIndexed("[data-testid='stMarkdownContainer']", 4)
            .should("contain.text", "This is a default toast message")

        cy.getIndexed("[data-testid='toastContainer'] > div", 4)
            .matchImageSnapshot("toast-default-dark");
    });

    it("displays success toast correctly", () => {
        cy.getIndexed("[data-testid='stMarkdownContainer']", 3)
            .should("contain.text", "This is a success toast message")

        cy.getIndexed("[data-testid='toastContainer'] > div", 3)
            .matchImageSnapshot("toast-success-dark");
    });

    it("displays warning toast correctly", () => {
        cy.getIndexed("[data-testid='stMarkdownContainer']", 2)
            .should("contain.text", "This is a warning toast message")

        cy.getIndexed("[data-testid='toastContainer'] > div", 2)
            .matchImageSnapshot("toast-warning-dark");
    });

    it("displays error toast correctly", () => {
        cy.getIndexed("[data-testid='stMarkdownContainer']", 1)
            .should("contain.text", "This is a error toast message")

        cy.getIndexed("[data-testid='toastContainer'] > div", 1)
            .matchImageSnapshot("toast-error-dark");
    });

    it("displays long message toast correctly", () => {
        cy.getIndexed("[data-testid='stMarkdownContainer']", 0)
            .should(
                "contain.text",
                "Random toast message that is a really really really really really really really long message, going way")

        cy.getIndexed("[data-testid='toastContainer'] > div", 0)
            .matchImageSnapshot("toast-long-dark");
    });

    it("displays expanded long message toast correctly", () => {
        cy.get("[data-testid='toastContainer'] > div").eq(0).find('button').click();

        cy.getIndexed("[data-testid='stMarkdownContainer']", 0)
            .should(
                "contain.text",
                "Random toast message that is a really really really really really really really long message, going way past the 3 line limit"
            );

        cy.getIndexed("[data-testid='toastContainer'] > div", 0)
            .matchImageSnapshot("toast-expanded-dark");
    });
});