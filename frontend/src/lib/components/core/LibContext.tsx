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

import React from "react"

import { baseTheme, ThemeConfig } from "src/lib/theme"

export interface Props {
  /** True if the app is in full-screen mode. */
  isFullScreen: boolean

  /** Function that sets the `isFullScreen` property. */
  setFullScreen: (value: boolean) => void

  /**
   * Add a callback that will be called every time the app's script finishes
   * executing.
   */
  addScriptFinishedHandler: (func: () => void) => void

  /** Remove a previously-added scriptFinishedHandler callback. */
  removeScriptFinishedHandler: (func: () => void) => void

  /** The currently active app theme. */
  activeTheme: ThemeConfig

  /**
   * Set the app's active theme locally and send it the app's host (if any).
   * @see App.setAndSendTheme
   */
  setTheme: (theme: ThemeConfig) => void

  /** List of all available themes. */
  availableThemes: ThemeConfig[]

  /**
   * Call to add additional themes to the app.
   * @see ThemeCreatorDialog
   */
  addThemes: (themes: ThemeConfig[]) => void
}

export const LibContext = React.createContext<Props>({
  isFullScreen: false,
  setFullScreen: () => {},
  addScriptFinishedHandler: () => {},
  removeScriptFinishedHandler: () => {},
  activeTheme: baseTheme,
  setTheme: () => {},
  availableThemes: [],
  addThemes: () => {},
})
