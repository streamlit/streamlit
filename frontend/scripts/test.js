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

"use strict"

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = "test"
process.env.NODE_ENV = "test"
process.env.PUBLIC_URL = ""

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err
})

// Ensure environment variables are read.
require("../config/env")

const jest = require("jest")
const execSync = require("child_process").execSync
let argv = process.argv.slice(2)

function isInGitRepository() {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" })
    return true
  } catch (e) {
    return false
  }
}

function isInMercurialRepository() {
  try {
    execSync("hg --cwd . root", { stdio: "ignore" })
    return true
  } catch (e) {
    return false
  }
}

// Watch unless on CI or explicitly running all tests
if (
  !process.env.CI &&
  argv.indexOf("--watchAll") === -1 &&
  argv.indexOf("--watchAll=false") === -1
) {
  // https://github.com/facebook/create-react-app/issues/5210
  const hasSourceControl = isInGitRepository() || isInMercurialRepository()
  argv.push(hasSourceControl ? "--watch" : "--watchAll")
}

jest.run(argv)
