// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import "./commands"

// Thiago has anti-aliasing setup on his machine so we match it in the tests
const isStyleLoaded = head => head.find("#st-font-antialiased").length > 0

beforeEach(() => {
  const head = Cypress.$(parent.window.document.head)

  if (isStyleLoaded(head)) {
    return
  }

  const css = `
    body {
      -webkit-font-smoothing: antialiased;
    }
  `
  head.append(
    `<style type="text/css" id="st-font-antialiased">\n${css}</style>`
  )
})
