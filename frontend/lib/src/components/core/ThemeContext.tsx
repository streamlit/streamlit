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

import { getDefaultTheme, ThemeConfig } from "~lib/theme"

export interface ThemeContextProps {
  /**
   * The currently active app theme. Contains the full theme configuration
   * including emotion styles, baseui theme, and custom theme input.
   *
   * Used for theme-dependent styling, responsive breakpoints, and visual
   * customization throughout the app.
   *
   * This context is optimized for components that need to react to theme
   * changes without re-rendering on unrelated updates.
   *
   * Consumed by:
   * @see ThemedSidebar
   * @see Header
   * @see AppView
   * @see useViewportSize
   * @see SettingsDialog
   */
  activeTheme: ThemeConfig

  /**
   * Set the app's active theme locally and send it to the app's host (if any).
   * Used when the user selects a different theme in the settings dialog.
   *
   * Consumed by: SettingsDialog
   * @see SettingsDialog
   * @see App.setAndSendTheme
   */
  setTheme: (theme: ThemeConfig) => void

  /**
   * List of all available themes (Light, Dark, Auto, or Custom).
   * Used to populate the theme selector dropdown in settings.
   *
   * Consumed by: SettingsDialog
   * @see SettingsDialog
   */
  availableThemes: ThemeConfig[]
}

/**
 * ThemeContext provides theme configuration and management throughout the app.
 *
 * We provide safe default values to prevent crashes during initial render
 * before the App component has fully initialized. The default theme respects:
 * 1. Cached user preferences from localStorage
 * 2. Host-specified theme from query parameters (e.g., embed_options)
 * 3. System dark mode preference
 */
export const ThemeContext = createContext<ThemeContextProps>({
  activeTheme: getDefaultTheme(),
  setTheme: () => {},
  availableThemes: [],
})

// Set the context display name for React DevTools
ThemeContext.displayName = "ThemeContext"
