/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import ReactDOM from "react-dom"
import App from "./App"

import { Client as Styletron } from "styletron-engine-atomic"
import { LightTheme, BaseProvider } from "baseui"
import { Provider as StyletronProvider } from "styletron-react"
import { SCSS_VARS } from "autogen/scssVariables"

const engine = new Styletron({ prefix: "st-" })
const popupZIndex = Number(SCSS_VARS["$z-index-popup-menu"])

ReactDOM.render(
  <StyletronProvider value={engine}>
    {/*
      The BaseProvider type definition doesn't support zIndex, but the object
      actually does. See: https://baseweb.design/components/base-provider/
      // @ts-ignore */}
    <BaseProvider theme={LightTheme} zIndex={popupZIndex}>
      <App />
    </BaseProvider>
  </StyletronProvider>,
  document.getElementById("root")
)
