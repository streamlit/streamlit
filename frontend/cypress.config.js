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

const { defineConfig } = require("cypress")

module.exports = defineConfig({
  trashAssetsBeforeRuns: false,
  viewportWidth: 1366,
  viewportHeight: 768,
  chromeWebSecurity: false,

  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return require("./cypress/plugins/index.js")(on, config)
    },
    specPattern: "../e2e/specs/**/*.spec.{js,jsx,ts,tsx}",

    // Turning this off since our tests were all built with the assumption
    // this was off (which was the default behavior). But we should really turn
    // this on!
    testIsolation: false,
  },
})
