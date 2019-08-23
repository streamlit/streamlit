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

import path from 'path'

// https://github.com/palmerhq/cypress-image-snapshot#installation
import {addMatchImageSnapshotCommand} from 'cypress-image-snapshot/command'

/**
 * Returns an OS and device-pixel-ratio specific snapshot folder, e.g. <rootDir>/cypress/snapshots/darwin/2x
 * We use per-OS snapshots to account for rendering differences in fonts and UI widgets.
 * We use per-DPR snapshots to account for rendering differences in image dimensions.
 */
function getSnapshotFolder() {
  const devicePixelRatio = Cypress.env('devicePixelRatio') || 2
  return path.join('cypress', 'snapshots', Cypress.platform, devicePixelRatio + 'x')
}

addMatchImageSnapshotCommand({
  customSnapshotsDir: getSnapshotFolder(),
  failureThreshold: 0.03, // Threshold for entire image
  failureThresholdType: 'percent', // Percent of image or number of pixels
})
