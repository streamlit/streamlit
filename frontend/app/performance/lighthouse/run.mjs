/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

/* eslint-disable @typescript-eslint/explicit-function-return-type */
// @ts-check
import fs from "fs"
import path from "path"

import { LighthouseOrchestrator } from "./LighthouseOrchestrator.mjs"
import {
  MODES,
  MULTIPAGE_APPS,
  PERFORMANCE_APPS_DIRECTORY,
  STREAMLIT_ROOT,
} from "./constants.mjs"

/**
 * Run the Lighthouse performance test suite.
 * @param {string} appsDirectory The directory containing the streamlit apps to
 * run
 * @param {string[]} additionalApps An array of additional performance apps to
 * run
 */
const run = async (appsDirectory, additionalApps = []) => {
  // Get the current date and time, convert it to an ISO string, remove
  // characters '-', ':', '.', 'T', and 'Z'.
  const now = new Date().toISOString().replace(/[-:.TZ]/g, "")
  // Create a runId in the format 'YYYYMMDD-HHMMSS' for lexicographical sorting.
  const runId = `${now.slice(0, 8)}-${now.slice(8, 14)}`

  /**
   * An array of performance app filenames.
   * @type {string[]}
   */
  const appsFromAppsDirectory = fs
    .readdirSync(appsDirectory, { withFileTypes: true })
    .filter(entry => {
      return (
        !entry.isDirectory() &&
        entry.name.endsWith(".py") &&
        entry.name !== "__init__.py"
      )
    })
    .map(({ name }) => name)

  const performanceApps = [...appsFromAppsDirectory, ...additionalApps]
  const orchestrator = new LighthouseOrchestrator()

  process.on("SIGINT", async () => {
    orchestrator.destroy()
    // Exit with a non-zero status code to indicate that the process was
    // interrupted.
    process.exit(1)
  })

  await orchestrator.initialize()

  try {
    for (const appName of performanceApps) {
      const appPath = path.join(appsDirectory, appName)
      await orchestrator.startStreamlit(appPath, STREAMLIT_ROOT)

      for (const mode of Object.keys(MODES)) {
        await orchestrator.runLighthouse(appName, mode, runId)
      }

      await orchestrator.stopStreamlit()
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    orchestrator.destroy()
    // Exit with a non-zero status code to indicate that there was an error.
    process.exit(1)
  }

  orchestrator.destroy()
}

await run(PERFORMANCE_APPS_DIRECTORY, MULTIPAGE_APPS)

process.exit(0)
