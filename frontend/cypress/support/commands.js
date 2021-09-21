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
