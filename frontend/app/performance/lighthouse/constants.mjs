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
import { defaultConfig, desktopConfig } from "lighthouse"

import path from "path"
import { execSync } from "child_process"

const getGitRoot = () => {
  try {
    return execSync("git rev-parse --show-toplevel").toString().trim()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Not a git repository or no git installed.")
    process.exit(1)
  }
}

/**
 * The root directory of the Streamlit project.
 * @type {string}
 */
export const STREAMLIT_ROOT = getGitRoot()

/**
 * The directory containing performance apps.
 * @type {string}
 */
export const PERFORMANCE_APPS_DIRECTORY = path.resolve(
  STREAMLIT_ROOT,
  "./frontend/app/performance/apps"
)

export const MULTIPAGE_APPS = ["./multipage/multipage_app.py"]

/**
 * Mode configurations that Lighthouse will run in.
 * @see https://github.com/GoogleChrome/lighthouse/blob/main/docs/configuration.md
 */
export const MODES = {
  desktop: desktopConfig,
  mobile: defaultConfig,
}
