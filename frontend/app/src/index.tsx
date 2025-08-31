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

// Timestamp when the Streamlit execution started for GUEST_READY message
const streamlitExecutionStartedAt = Date.now()

import React, { StrictMode } from "react"

import log from "loglevel"
import { createRoot } from "react-dom/client"
import { HelmetProvider } from "react-helmet-async"
import { Client as Styletron } from "styletron-engine-atomic"
import { Provider as StyletronProvider } from "styletron-react"

import ThemedApp from "./ThemedApp"

const engine = new Styletron({ prefix: "st-" })
if (process.env.NODE_ENV === "development") {
  // By default, loglevel only shows warnings and errors.
  log.setLevel(log.levels.DEBUG)
}

const rootDomNode = document.getElementById("root")

if (!rootDomNode) {
  throw new Error("#root DOM element not found")
}

const reactRoot = createRoot(rootDomNode)

reactRoot.render(
  <StrictMode>
    <HelmetProvider>
      <StyletronProvider value={engine}>
        <ThemedApp streamlitExecutionStartedAt={streamlitExecutionStartedAt} />
      </StyletronProvider>
    </HelmetProvider>
  </StrictMode>
)
