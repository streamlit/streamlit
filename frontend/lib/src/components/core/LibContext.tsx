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

import { baseTheme, ThemeConfig } from "@streamlit/lib/src/theme"

/**
 * The lib config contains various configurations that the host platform can
 * use to configure streamlit-lib frontend behavior. This should to be treated as part of the public
 * API, and changes need to be backwards-compatible meaning that an old host configuration
 * should still work with a new frontend versions.
 */
export type LibConfig = {
  /**
   * the mapbox token that can be configured by a platform
   */
  mapboxToken?: string

  /**
   * Whether to disable the full screen mode all elements / widgets.
   */
  disableFullscreenMode?: boolean
}

export interface LibContextProps {
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

  /**
   * Change the page in a multi-page app.
   * @see PageLink
   */
  onPageChange: (pageScriptHash: string) => void

  /**
   * The current page of a multi-page app.
   * @see PageLink
   */
  currentPageScriptHash: string

  /** The lib-specific configuration from the apps host which is requested via the
   * _stcore/host-config endpoint.
   */
  libConfig: LibConfig
}

export const LibContext = React.createContext<LibContextProps>({
  isFullScreen: false,
  setFullScreen: () => {},
  addScriptFinishedHandler: () => {},
  removeScriptFinishedHandler: () => {},
  activeTheme: baseTheme,
  setTheme: () => {},
  availableThemes: [],
  addThemes: () => {},
  onPageChange: () => {},
  currentPageScriptHash: "",
  libConfig: {},
})
