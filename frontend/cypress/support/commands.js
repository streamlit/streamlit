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

// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This is will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

import path from "path"
import * as _ from "lodash"

// https://github.com/palmerhq/cypress-image-snapshot#installation
import { addMatchImageSnapshotCommand } from "cypress-image-snapshot/command"
import "cypress-file-upload"

/**
 * Returns an OS and device-pixel-ratio specific snapshot folder, e.g. <rootDir>/cypress/snapshots/darwin/2x
 * We use per-OS snapshots to account for rendering differences in fonts and UI widgets.
 * We use per-DPR snapshots to account for rendering differences in image dimensions.
 */
function getSnapshotFolder() {
  const devicePixelRatio = Cypress.env("devicePixelRatio") || 2
  return path.join(
    "cypress",
    "snapshots",
    Cypress.platform,
    devicePixelRatio + "x"
  )
}

addMatchImageSnapshotCommand({
  customSnapshotsDir: getSnapshotFolder(),
  failureThreshold: 0.01, // Threshold for entire image
  failureThresholdType: "percent", // Percent of image or number of pixels
})

Cypress.Commands.add("openSettings", () => {
  cy.get("#MainMenu > button").click()
  cy.get('[data-testid="main-menu-list"]').should("contain.text", "Settings")
  cy.get('[data-testid="main-menu-list"]')
    .contains("Settings")
    .click({ force: true })
})

Cypress.Commands.add("changeTheme", theme => {
  cy.openSettings()
  cy.get('[data-baseweb="modal"] .stSelectbox').then(el => {
    cy.wrap(el)
      .find("input")
      .click()
    cy.get("li")
      .contains(theme)
      .click()
  })
  cy.get('[data-baseweb="modal"] [aria-label="Close"]').click()
})

Cypress.Commands.add(
  "matchThemedSnapshots",
  { prevSubject: true },
  (subject, name, options) => {
    const testName = name || Cypress.mocha.getRunner().suite.ctx.test.title
    const setStates = () => {
      const { focus } = _.pick(options, ["focus"])
      if (focus) {
        cy.get(subject).within(() => {
          cy.get(focus).focus()
        })
      }
    }

    // Get dark mode snapshot first. Taking light mode snapshot first
    // for some reason ends up comparing dark with light
    cy.changeTheme("Dark")
    setStates()
    cy.wrap(subject).matchImageSnapshot(`${testName}-dark`, {
      ...options,
      force: false,
    })

    // Revert back to light mode
    cy.changeTheme("Light")
    setStates()
    cy.wrap(subject).matchImageSnapshot(name, { ...options, force: false })
    cy.screenshot()
  }
)

// Calling trigger before capturing the snapshot forces Cypress to very Actionability.
// https://docs.cypress.io/guides/core-concepts/interacting-with-elements.html#Actionability
// This fixes the issue where snapshots are cutoff or the wrong element is captured.
Cypress.Commands.overwrite(
  "matchImageSnapshot",
  (originalFn, subject, name, options) => {
    cy.wrap(subject).trigger("blur", _.pick(options, ["force"]))
    return originalFn(subject, name, options)
  }
)

Cypress.Commands.add("loadApp", appUrl => {
  cy.visit(appUrl)

  // Wait until we know the script has started. We have to do this
  // because the status widget is initially hidden (so that it doesn't quickly
  // appear and disappear if the user has it configured to be hidden). Without
  // waiting here, it's possible to pass the status widget check below before
  // it initially renders.
  cy.get("[data-testid='stAppViewContainer']", { timeout: 10000 }).should(
    "not.contain",
    "Please wait..."
  )

  // Wait until the script is no longer running.
  cy.get("[data-testid='stStatusWidget']", { timeout: 10000 }).should(
    "not.exist"
  )
})

// Indexing into a list of elements produced by `cy.get()` may fail if not enough
// elements are rendered, but this does not prompt cypress to retry the `get` call,
// so the list will never update. This is a major cause of flakiness in tests.
// The solution is to use `should` to wait for enough elements to be available first.
// This is a convenience function for doing this automatically.
Cypress.Commands.add("getIndexed", (selector, index) =>
  cy
    .get(selector)
    .should("have.length.at.least", index + 1)
    .eq(index)
)

// The header at the top of the page can sometimes interfere when we are
// attempting to take snapshots. This command removes the problematic parts to
// avoid this issue.
Cypress.Commands.add("prepForElementSnapshots", () => {
  // Make the ribbon decoration line disappear as it can occasionally get
  // caught when a snapshot is taken.
  cy.get("[data-testid='stDecoration']").invoke("css", "display", "none")

  // Similarly, the header styling can sometimes interfere with the snapshot
  // for elements near the top of the page.
  cy.get(".stApp > header").invoke("css", "background", "none")
  cy.get(".stApp > header").invoke("css", "backdropFilter", "none")
})

// Rerun the script by simulating the user pressing the 'r' key.
Cypress.Commands.add("rerunScript", () => {
  cy.get(".stApp [data-testid='stHeader']").trigger("keypress", {
    keyCode: 82, // "r"
    which: 82, // "r"
    force: true,
  })
})
