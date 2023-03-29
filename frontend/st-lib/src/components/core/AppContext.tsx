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

import { PageConfig } from "src/autogen/proto"
import { baseTheme, ThemeConfig } from "src/theme"

export interface AppContextProps {
  /**
   * If true, render the app with a wider column size.
   * Set from the UserSettings object.
   * @see UserSettings
   */
  wideMode: boolean

  /**
   * The sidebar's default display state.
   * Set from the PageConfig protobuf.
   */
  initialSidebarState: PageConfig.SidebarState

  /**
   * True if the app is embedded.
   * @see isEmbed
   */
  embedded: boolean

  /**
   * True if padding is enabled.
   * @see isPaddingDisplayed
   */
  showPadding: boolean

  /**
   * True if scrolling is disabled.
   * @see isScrollingHidden
   */
  disableScrolling: boolean

  /**
   * True if the footer should be displayed.
   * @see isFooterDisplayed
   */
  showFooter: boolean

  /**
   * True if the toolbar should be displayed.
   * @see isToolbarDisplayed
   */
  showToolbar: boolean

  /**
   * True if the thin colored line at the top of the app should be displayed.
   * @see isColoredLineDisplayed
   */
  showColoredLine: boolean

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
   * If non-zero, this is the number of pixels that the sidebar's
   * "chevron" icon is shifted. (If sidebarChevronDownshift is 0, then
   * the current theme's spacing is used.)
   * @see StyledSidebarCollapsedControl
   */
  sidebarChevronDownshift: number
}

export const AppContext = React.createContext<AppContextProps>({
  wideMode: false,
  initialSidebarState: PageConfig.SidebarState.AUTO,
  embedded: false,
  showPadding: false,
  disableScrolling: false,
  showFooter: false,
  showToolbar: false,
  showColoredLine: false,
  isFullScreen: false,
  setFullScreen: () => {},
  addScriptFinishedHandler: () => {},
  removeScriptFinishedHandler: () => {},
  activeTheme: baseTheme,
  setTheme: () => {},
  availableThemes: [],
  addThemes: () => {},
  sidebarChevronDownshift: 0,
})
