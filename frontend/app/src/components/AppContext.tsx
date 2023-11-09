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

import { PageConfig, IGitInfo, AppConfig } from "@streamlit/lib"

export interface Props {
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

  /**
   * Part of URL construction for an app page in a multi-page app;
   * this is set from the host communication manager via host message.
   * @see SidebarNav
   */
  pageLinkBaseUrl: string

  /**
   * If non-zero, this is the number of pixels that the sidebar's
   * "chevron" icon is shifted. (If sidebarChevronDownshift is 0, then
   * the current theme's spacing is used.);
   * this is set from the host communication manager via host message.
   * @see StyledSidebarCollapsedControl
   */
  sidebarChevronDownshift: number

  /**
   * Adjustment to positioning of the app's toasts
   * based on information sent from the host.
   * @see EventContainer
   */
  toastAdjustment: boolean

  /**
   * The latest state of the git information related to the app.
   */
  gitInfo: IGitInfo | null

  /** The app-specific configuration from the apps host which is requested via the
   * _stcore/host-config endpoint.
   */
  appConfig: AppConfig
}

export const AppContext = React.createContext<Props>({
  wideMode: false,
  initialSidebarState: PageConfig.SidebarState.AUTO,
  embedded: false,
  showPadding: false,
  disableScrolling: false,
  showFooter: false,
  showToolbar: false,
  showColoredLine: false,
  pageLinkBaseUrl: "",
  sidebarChevronDownshift: 0,
  toastAdjustment: false,
  gitInfo: null,
  appConfig: {},
})
