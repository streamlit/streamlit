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

import { createContext } from "react"

import { ComponentState, StreamlitTheme } from "@streamlit/component-v2-lib"

import { WidgetStateManager } from "~lib/WidgetStateManager"

export type BidiComponentContextShape<
  TComponentState extends ComponentState = ComponentState,
  DataShape = unknown,
> = {
  componentName: string
  cssContent: string | undefined
  cssSourcePath: string | undefined
  data: DataShape
  fragmentId: string | undefined
  getWidgetValue: () => TComponentState
  htmlContent: string | undefined
  id: string
  formId: string | undefined
  jsContent: string | undefined
  jsSourcePath: string | undefined
  theme: StreamlitTheme
  widgetMgr: WidgetStateManager
}

export const BidiComponentContext =
  createContext<BidiComponentContextShape | null>(null)
BidiComponentContext.displayName = "BidiComponentContext"
