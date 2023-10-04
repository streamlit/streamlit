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

describe("Host communication", () => {
    before(() => {
        cy.visit("hostframe.html");
        cy.get("#toolbar button").should("have.length", 9);
        cy.get("iframe")
            .iframe(() => {
                cy.waitForScriptFinish()
            });
    });

    it("handles a host theme message", () => {
        cy.get("iframe").iframe(() => {
            cy.prepForElementSnapshots()
        });

        cy.get("iframe").first().matchImageSnapshot("theme-message-before");
        cy.get("#toolbar").contains("Send Theme").click();
        cy.get("iframe").first().matchImageSnapshot("theme-message-after");
    });

    it("handles a host rerun script message", () => {
        cy.get("#toolbar").contains("Rerun Script").click();
        // Check that status widget is running
        cy.get("iframe").iframe(() => {
            cy.get("[data-testid='stStatusWidget']").should("exist")
        });
    });

    it("handles a host stop script message", () => {
        // Make sure script is running
        cy.get("#toolbar").contains("Rerun Script").click();
        // Check that status widget is running
        cy.get("iframe").iframe(() => {
            cy.get("[data-testid='stStatusWidget']").should("exist")
        });

        // Stop script
        cy.get("#toolbar").contains("Stop Script").click();
        // Check that status widget is no longer running
        cy.get("iframe").iframe(() => {
            cy.get("[data-testid='stStatusWidget']").should("not.exist")
        });
    });

    it("handles a host close modal message", () => {
        cy.get("iframe")
            .iframe(() => {
                // Open the Main Menu
                cy.get("#MainMenu > button").click()
                // Open the Settings Modal
                cy.getIndexed('[data-testid="main-menu-list"] > ul', 1).click({ force: true })
                cy.get("div[role='dialog']").should("exist")
            });
        // Close modal
        cy.get("#toolbar").contains("Close modal").click();
        // Check that modal is no longer open
        cy.get("iframe").iframe(() => {
            cy.get("div[role='dialog']").should("not.exist")
        });
    });

    it("handles a host menu item message", () => {
        // Add Menu Item message
        cy.get("#toolbar").contains("Add Menu Item").click({ force: true });
        cy.get("iframe")
            .iframe(() => {
                // Open the Main Menu
                cy.get("#MainMenu > button").click()
                // Check that new menu item exists
                cy.getIndexed('[data-testid="main-menu-list"] > ul', 4).should("have.text", "Adopt a Corgi")
                // Exit main menu
                cy.get(".main").type('{esc}')
            });
    });

    it("handles a host toolbar item message", () => {
        // Add Toolbar Item message
        cy.get("#toolbar").contains("Add Toolbar Item").click();
        cy.get("iframe")
            .iframe(() => {
                // Check toolbar contents
                cy.get('.stActionButton').should("exist")
                cy.getIndexed('[data-testid="stActionButton"]', 0).should("have.text", "Favorite")
                cy.getIndexed('[data-testid="stActionButton"]', 1).should("have.text", "Share")
            });
    });

    it("displays the toolbar with horizontal buttons", () => {
        cy.get("iframe").first().matchImageSnapshot("toolbarActions");
    })

    it("handles a hide sidebar nav message", () => {
        cy.get("iframe").iframe(() => {
            // Check that initially, MPA sidebar nav is visible
            cy.get("[data-testid='stSidebarNav']").should("exist")
        });
        // Trigger hide sidebar nav
        cy.get("#toolbar").contains("Hide Sidebar Nav").click();
        cy.get("iframe").iframe(() => {
            // Check that MPA sidebar nav is hidden
            cy.get("[data-testid='stSidebarNav']").should("not.exist")
        });
    });

    it("handles a host sidebar downshift message", () => {
        // Trigger sidebar downshift
        cy.get("#toolbar").contains("Sidebar Chevron Downshift").click();
        cy.get("iframe")
            .iframe(() => {
                // Close sidebar
                cy.get("[data-testid='stSidebar'] button").click()
                // Check chevron positioning
                cy.get("[data-testid='collapsedControl']").should("have.css", "top", "50px")
            });
    });
});
