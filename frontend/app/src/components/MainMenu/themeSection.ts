/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

/**
 * Theme section builder for the MainMenu.
 *
 * Converts ThemeContext state (activeTheme, availableThemes, setTheme) into
 * MenuRadioItem[] data that the MainMenu rendering loop can display as
 * `menuitemradio` elements.
 */

import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import {
  AUTO_THEME_NAME,
  CUSTOM_THEME_AUTO_NAME,
  CUSTOM_THEME_DARK_NAME,
  CUSTOM_THEME_LIGHT_NAME,
  darkTheme,
  getThemeSelectionFromThemeConfig,
  lightTheme,
  ThemeConfig,
  ThemeSelection,
} from "@streamlit/lib"

import type { MenuSection } from "./MainMenu"

interface ThemeOptionConfig {
  label: ThemeSelection
  icon: string
}

const THEME_OPTIONS: ThemeOptionConfig[] = [
  { label: "System", icon: ":material/contrast:" },
  { label: "Light", icon: ":material/light_mode:" },
  { label: "Dark", icon: ":material/dark_mode:" },
]

/**
 * Finds the theme matching a given selection from the available themes.
 * Handles both preset themes (Light, Dark, Auto) and custom theme variants.
 */
export function findThemeForSelection(
  selection: ThemeSelection,
  availableThemes: ThemeConfig[]
): ThemeConfig | undefined {
  switch (selection) {
    case "System":
      return availableThemes.find(
        theme =>
          theme.name === CUSTOM_THEME_AUTO_NAME ||
          theme.name === AUTO_THEME_NAME
      )
    case "Light":
      return availableThemes.find(
        theme =>
          theme.name === CUSTOM_THEME_LIGHT_NAME ||
          theme.name === lightTheme.name
      )
    case "Dark":
      return availableThemes.find(
        theme =>
          theme.name === CUSTOM_THEME_DARK_NAME ||
          theme.name === darkTheme.name
      )
  }
}

/**
 * Builds the theme selection section as radio items.
 * Returns [] when:
 * - No themes are available (nothing to switch between)
 * - Only a single custom theme is available (no light/dark variants)
 */
export function buildThemeSection(
  activeTheme: ThemeConfig,
  availableThemes: ThemeConfig[],
  setTheme: (theme: ThemeConfig) => void,
  metricsMgr: MetricsManager
): MenuSection {
  // Hide when there is nothing to switch between.
  // availableThemes is either 3 (preset or custom light/dark/auto) or 1 (single
  // custom theme with no light/dark variants).
  if (availableThemes.length <= 1) {
    return []
  }

  const activeSelection = getThemeSelectionFromThemeConfig(activeTheme)

  return THEME_OPTIONS.map(option => ({
    type: "radio" as const,
    key: `theme-${option.label}`,
    label: option.label,
    icon: option.icon,
    checked: activeSelection === option.label,
    onSelect: () => {
      const newTheme = findThemeForSelection(option.label, availableThemes)
      if (newTheme) {
        metricsMgr.enqueue("menuClick", { label: "changeTheme" })
        setTheme(newTheme)
      }
    },
  }))
}
