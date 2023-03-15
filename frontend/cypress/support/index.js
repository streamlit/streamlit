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
const dayjs = require("dayjs")
const utc = require("dayjs/plugin/utc")
const timezone = require("dayjs/plugin/timezone")
dayjs.extend(utc)
dayjs.extend(timezone)

Cypress.dayjs = dayjs

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
