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
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

const {
  addMatchImageSnapshotPlugin,
} = require("cypress-image-snapshot/plugin")

module.exports = (on, config) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config

  // enable printing to terminal
  on("task", {
    log(message) {
      console.log(message)
      return null
    },
  })

  on("before:browser:launch", (browser, launchOptions, ...args) => {
    if ("CYPRESS_BROWSER_WINDOW_SIZE" in config.env) {
      const [width, height] =
        config.env.CYPRESS_BROWSER_WINDOW_SIZE.toLowerCase()
          .split("x", 2)
          .map(d => parseInt(d))
      if (browser.name === "chrome" && browser.isHeadless) {
        launchOptions.args.push(`--window-size=${width},${height}`)

        // force screen to be non-retina
        launchOptions.args.push("--force-device-scale-factor=1")
      }

      if (browser.name === "electron" && browser.isHeadless) {
        launchOptions.preferences.width = width
        launchOptions.preferences.height = height
      }
    }

    return launchOptions
  })

  // https://github.com/palmerhq/cypress-image-snapshot#installation
  addMatchImageSnapshotPlugin(on, config)
}
