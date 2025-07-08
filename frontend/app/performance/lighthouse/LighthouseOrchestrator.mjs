/* eslint-disable no-console */
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
// eslint-disable-next-line import/no-extraneous-dependencies
import lighthouse from "lighthouse"
// eslint-disable-next-line import/no-extraneous-dependencies
import * as chromeLauncher from "chrome-launcher"
// eslint-disable-next-line import/no-extraneous-dependencies
import { default as treeKill } from "tree-kill"

import fs from "fs"
import path from "path"
import { exec, execSync } from "child_process"

import { MODES } from "./constants.mjs"

const PATHNAME = new URL(".", import.meta.url).pathname
const REPORTS_DIRECTORY = path.resolve(
  PATHNAME,
  "../../../../.benchmarks/lighthouse"
)

/**
 * This class is responsible for managing the lifecycle of a headless Chrome
 * instance and a Streamlit application, and running Lighthouse audits on the
 * Streamlit application.
 */
export class LighthouseOrchestrator {
  constructor() {
    this.chrome = null
    this.streamlit = null
    this._initialized = false
  }

  /**
   * Initialize the LighthouseOrchestrator by launching a headless Chrome
   * instance.
   * @returns {Promise<void>}
   */
  async initialize() {
    const MAX_RETRIES = 3
    let retryCount = 0

    while (retryCount <= MAX_RETRIES) {
      try {
        console.log(
          `Launching Chrome in headless mode (attempt ${retryCount + 1}/${
            MAX_RETRIES + 1
          })...`
        )
        this.chrome = await chromeLauncher.launch({
          chromeFlags: ["--headless"],
        })
        console.log(`Chrome launched successfully on port ${this.chrome.port}`)
        this._initialized = true
        return
      } catch (error) {
        retryCount++
        if (retryCount > MAX_RETRIES) {
          console.error(
            `Failed to launch Chrome after ${MAX_RETRIES + 1} attempts:`,
            error
          )
          throw new Error(`Chrome launch failed: ${error.message}`)
        }
        console.log(
          `Chrome launch failed, retrying... (${retryCount}/${MAX_RETRIES})`
        )
        // Wait for 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  /**
   * Destroy the LighthouseOrchestrator by stopping the Chrome and Streamlit
   * processes.
   * @returns {Promise<void>}
   */
  async destroy() {
    this.chrome?.kill()

    if (this.streamlit) {
      await this.stopStreamlit()
    }
  }

  /**
   * Creates a virtual environment for Streamlit.
   * @param {string} streamlitRoot - The root directory of the Streamlit project.
   */
  createVirtualEnvironment(streamlitRoot) {
    console.log(`Creating virtual environment for Streamlit...`)
    const libPath = path.join(streamlitRoot, "lib")
    execSync(`cd ${libPath} && python -m venv venv && cd ${streamlitRoot}`)
    console.log(`Virtual environment created`)
  }

  /**
   * Start a Streamlit application.
   * @param {string} appPath - The path to the Streamlit application.
   * @param {string} streamlitRoot - The root directory of the Streamlit
   * installation.
   * @returns {Promise<boolean>} - Resolves to true if Streamlit starts
   * successfully.
   * @throws {Error} - If Streamlit is already running.
   */
  startStreamlit(appPath, streamlitRoot) {
    if (this.streamlit) {
      throw new Error("Streamlit is already running")
    }

    return new Promise((resolve, reject) => {
      console.log(`Starting Streamlit for ${appPath}...`)

      const activatePath = path.join(streamlitRoot, "lib/venv/bin/activate")

      if (!fs.existsSync(activatePath)) {
        this.createVirtualEnvironment(streamlitRoot)
      }

      // NOTE: These command args match what is in `e2e_playwright/conftest.py`
      this.streamlit = exec(
        ` . ${activatePath} && \
          streamlit run ${appPath} \
            --server.headless true \
            --global.developmentMode false \
            --global.e2eTest true \
            --server.port 3001 \
            --browser.gatherUsageStats false \
            --server.fileWatcherType none \
            --server.enableStaticServing true`
      )

      this.streamlit.stdout?.on("data", data => {
        console.log(`${data}`)

        if (data.includes("You can now view your Streamlit app")) {
          resolve(true)
        }
      })

      this.streamlit.stderr?.on("data", data => {
        console.error(`${data}`)
      })

      this.streamlit.on("close", code => {
        if (code === 0) {
          console.log("Streamlit process exited successfully")
          this.streamlit = null
          return resolve(true)
        }

        reject(`child process exited with code ${code}`)
      })
    })
  }

  /**
   * Stop the running Streamlit application.
   * @returns {Promise<boolean>} - Resolves to true if Streamlit stops
   * successfully.
   * @throws {Error} - If Streamlit is not running.
   */
  async stopStreamlit() {
    console.log("Stopping Streamlit...")

    return new Promise((resolve, reject) => {
      if (!this.streamlit || !this.streamlit.pid) {
        throw new Error("Streamlit is not running")
      }

      treeKill(this.streamlit.pid, err => {
        if (err) {
          return reject(err)
        }

        this.streamlit = null
        console.log("Stopped Streamlit")
        resolve(true)
      })
    })
  }

  /**
   * Run Lighthouse on the Streamlit application.
   * @param {string} appName - The name of the application.
   * @param {string} mode - The mode in which to run Lighthouse.
   * @param {string} runId - The ID of the run.
   * @returns {Promise<void>}
   * @throws {Error} - If Chrome is not running or if there is no runner result.
   */
  async runLighthouse(appName, mode, runId) {
    const sanitizedRunId = path.basename(runId)
    const appBaseName = (appName.split("/").pop() || "")?.split(".")[0]

    console.log(`Running Lighthouse for ${appBaseName} in ${mode} mode`)

    if (!this.chrome) {
      console.error(`Initialization status: ${this._initialized}`)
      throw new Error(
        "Chrome instance is not available. Did initialize() succeed?"
      )
    }

    const REPORT_NAME = [sanitizedRunId, appBaseName, mode, "lhreport"].join(
      "_-_"
    )

    try {
      const runnerResult = await lighthouse(
        "http://localhost:3001/",
        {
          logLevel: "info",
          output: "html",
          onlyCategories: ["performance"],
          port: this.chrome.port,
          maxWaitForLoad: 60 * 1000, // Wait up to 60 seconds for page load
        },
        MODES[mode]
      )

      if (!runnerResult) {
        throw new Error("No runner result")
      }

      // `.report` is the HTML report as a string
      const reportHtml = runnerResult.report
      if (Array.isArray(reportHtml)) {
        throw new Error("Report is an array")
      }

      if (!fs.existsSync(REPORTS_DIRECTORY)) {
        fs.mkdirSync(REPORTS_DIRECTORY)
      }

      fs.writeFileSync(
        path.join(REPORTS_DIRECTORY, `${REPORT_NAME}.html`),
        reportHtml
      )
      fs.writeFileSync(
        path.join(REPORTS_DIRECTORY, `${REPORT_NAME}.json`),
        JSON.stringify(runnerResult.lhr)
      )

      // `.lhr` is the Lighthouse Result as a JS object
      console.log("Report is done for", runnerResult.lhr.finalDisplayedUrl)
      console.log(
        "Performance score was",
        (runnerResult.lhr.categories.performance.score || 0) * 100
      )
    } catch (error) {
      console.error(
        `Lighthouse run failed for ${appBaseName} in ${mode} mode:`,
        error
      )
      throw error
    }
  }
}
