/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

// NOTE: The following line needs to be the first import to ensure that we
// correctly configure where chunked static assets are fetched from.
import "./setWebpackPublicPath"

import React from "react"

import { createRoot } from "react-dom/client"
import { Client as Styletron } from "styletron-engine-atomic"
import { Provider as StyletronProvider } from "styletron-react"
import { isNullOrUndefined } from "lib/src/util/utils"

import ThemedApp from "./ThemedApp"

const engine = new Styletron({ prefix: "st-" })
const container = document.getElementById("root")
if (isNullOrUndefined(container)) {
  throw new Error("root DOM object not found; could not mount React app!")
}

const root = createRoot(container)
root.render(
  <StyletronProvider value={engine}>
    <ThemedApp />
  </StyletronProvider>
)
